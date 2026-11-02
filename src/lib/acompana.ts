/**
 * La lógica del servicio: el saludo diario, la plática, las alertas y los resúmenes.
 * Cada función recibe sus dependencias para poder probarla sin WhatsApp ni IA reales.
 */
import { and, asc, desc, eq, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import { getDb, type Db } from "./db/client";
import { adultos, alertas, contactos, familias, medicinas, mensajes, platicas, recados, resumenes } from "./db/schema";
import { getIA, type IA, type Turno } from "./ai/ia";
import { getVoz, type Voz } from "./voz/voz";
import { getMensajero, type Mensajero } from "./whatsapp/mensajero";
import type { Entrante } from "./whatsapp/webhook";
import { detectarSenales, nivelMaximo, type Nivel } from "./ai/senales";
import type { Perfil } from "./ai/instrucciones";
import { ahoraEnZona, fechaLarga, minutosDeHora, minutosEntre } from "./tiempo";
import { env } from "./env";

export type Deps = { db: Db; ia: IA; voz: Voz; wa: Mensajero; ahora: () => Date; esperar?: (ms: number) => Promise<void> };

/** Se crean al usarse: así un error de configuración aparece solo donde realmente hace falta esa pieza. */
export function depsReales(): Deps {
  return {
    get db() { return getDb(); },
    get ia() { return getIA(); },
    get voz() { return getVoz(); },
    get wa() { return getMensajero(); },
    ahora: () => new Date(),
    esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}

/** Reglas de tiempo del programador (en minutos). */
export const REGLAS = {
  reintentoSinRespuesta: 120, // si no contesta, se vuelve a saludar a las 2 horas
  intentosMaximos: 3,
  cierrePorSilencio: 30, // si deja de contestar a media plática, se cierra y se resume
  esperaParaAgrupar: 7, // segundos: si manda varios mensajes seguidos, se contesta una sola vez a todos
};

// ─── Utilidades ──────────────────────────────────────────────

/** Debe coincidir con el texto de la plantilla "saludo_diario" aprobada en Meta. Sirve a cualquier hora. */
export function textoSaludo(comoLlamarle: string): string {
  return `Hola, ${comoLlamarle}, le saluda Acompaña. ¿Cómo está hoy? Puede contestarme con una nota de voz, como si platicáramos.`;
}

/** Debe coincidir con la plantilla "saludo_reintento". */
export function textoReintento(comoLlamarle: string): string {
  return `Hola otra vez. ${comoLlamarle}, solo quería saber cómo está. Cuando pueda, mándeme una nota de voz o un mensaje corto.`;
}

/** Los parámetros de plantillas de WhatsApp no aceptan saltos de línea ni tabuladores. */
export function limpiarParametro(texto: string, max = 900): string {
  const limpio = texto.replace(/[\n\r\t]+/g, " ").replace(/ {4,}/g, "   ").trim();
  return limpio.length > max ? `${limpio.slice(0, max - 1)}…` : limpio;
}

async function familiarPrincipal(db: Db, familiaId: string): Promise<string> {
  const [f] = await db.select().from(familias).where(eq(familias.id, familiaId));
  const [c] = await db.select().from(contactos).where(eq(contactos.familiaId, familiaId)).orderBy(asc(contactos.orden)).limit(1);
  if (c) return `${c.nombre} (${c.relacion})`;
  return f?.nombreContacto ?? "su familia";
}

export async function perfilDe(db: Db, adultoId: string, fecha: string): Promise<Perfil> {
  const [a] = await db.select().from(adultos).where(eq(adultos.id, adultoId));
  if (!a) throw new Error(`No existe el adulto ${adultoId}`);
  const meds = await db.select().from(medicinas).where(eq(medicinas.adultoId, adultoId));
  const anteriores = await db
    .select({ memoria: resumenes.memoria, fecha: platicas.fecha })
    .from(resumenes)
    .innerJoin(platicas, eq(resumenes.platicaId, platicas.id))
    .where(and(eq(platicas.adultoId, adultoId), isNotNull(resumenes.memoria)))
    .orderBy(desc(platicas.fecha))
    .limit(5);
  const memoria = anteriores
    .filter((r) => r.memoria && r.fecha !== fecha)
    .reverse()
    .flatMap((r) => r.memoria.split("\n").filter(Boolean).map((m) => `(${fechaLarga(r.fecha)}) ${m}`));
  const pendientes = await db.select().from(recados)
    .where(and(eq(recados.adultoId, adultoId), isNull(recados.entregadoEn)))
    .orderBy(asc(recados.creadoEn));
  return {
    nombre: a.nombre,
    comoLlamarle: a.comoLlamarle,
    sobreElla: a.sobreElla,
    medicinas: meds.map((m) => ({ nombre: m.nombre, dosis: m.dosis, horario: m.horario })),
    memoria,
    fechaLarga: fechaLarga(fecha),
    nombreFamiliar: await familiarPrincipal(db, a.familiaId),
    recados: pendientes.map((r) => `${r.deQuien}: ${r.texto}`),
  };
}

async function historialDe(db: Db, platicaId: string): Promise<Turno[]> {
  const ms = await db.select().from(mensajes).where(eq(mensajes.platicaId, platicaId)).orderBy(asc(mensajes.creadoEn));
  return ms.map((m) => ({ de: m.de, texto: m.texto }));
}

// ─── Alertas ─────────────────────────────────────────────────

export async function crearAlerta(
  d: Deps,
  datos: { adultoId: string; platicaId: string | null; nivel: Exclude<Nivel, "verde">; motivo: string; frase: string },
  opciones: { notificarFamilia?: boolean } = {},
) {
  // No repetir la misma alerta en la misma plática
  if (datos.platicaId) {
    const abiertas = await d.db.select().from(alertas).where(and(
      eq(alertas.platicaId, datos.platicaId), eq(alertas.estado, "abierta"), eq(alertas.nivel, datos.nivel),
    ));
    if (abiertas.some((x) => x.motivo === datos.motivo)) return null;
  }
  const [alerta] = await d.db.insert(alertas).values(datos).returning();
  const [a] = await d.db.select().from(adultos).where(eq(adultos.id, datos.adultoId));

  // A ti (o a quien esté de guardia) siempre te llega
  if (env.adminWhatsapp) {
    const dijo = datos.frase ? ` Dijo: "${datos.frase}".` : "";
    const aviso = `${datos.nivel === "rojo" ? "ALERTA ROJA" : "Alerta amarilla"}: ${a.comoLlamarle} (${a.nombre}). ${datos.motivo}.${dijo} Panel: ${env.appUrl}/panel/alertas`;
    await d.wa.enviarPlantilla(env.adminWhatsapp, env.plantillaAvisoInterno, [limpiarParametro(aviso)]).catch((e) => console.error("Aviso interno falló", e));
  }

  // En alerta roja confirmada la familia se entera de inmediato; las amarillas van en el resumen revisado
  const notificarFamilia = opciones.notificarFamilia ?? datos.nivel === "rojo";
  if (datos.nivel === "rojo" && notificarFamilia) {
    const cs = await d.db.select().from(contactos).where(and(eq(contactos.familiaId, a.familiaId), eq(contactos.recibeAlertas, true)));
    for (const c of cs) {
      await d.wa
        .enviarPlantilla(c.telefono, env.plantillaAlerta, [a.comoLlamarle, limpiarParametro(datos.motivo, 200), limpiarParametro(datos.frase || "sin detalles", 300)])
        .catch((e) => console.error(`Alerta a ${c.nombre} falló`, e));
    }
  }
  return alerta;
}

// ─── Plática ─────────────────────────────────────────────────

async function decirle(d: Deps, adulto: typeof adultos.$inferSelect, platicaId: string, texto: string) {
  let waId: string | null = null;
  let tipo: "audio" | "texto" = "texto";
  if (adulto.canal === "voz") {
    try {
      const audio = await d.voz.sintetizar(texto);
      waId = await d.wa.enviarAudio(adulto.telefono, audio);
      tipo = "audio";
    } catch (e) {
      console.error("No se pudo mandar la nota de voz; se manda texto", e);
    }
  }
  if (!waId) waId = await d.wa.enviarTexto(adulto.telefono, texto);
  await d.db.insert(mensajes).values({ platicaId, de: "acompana", tipo, texto, waMessageId: waId });
}

async function aTexto(d: Deps, m: Entrante): Promise<string> {
  if (m.tipo === "texto") return m.texto;
  if (m.tipo === "audio") {
    try {
      const { datos, mime } = await d.wa.descargarMedia(m.mediaId);
      return await d.voz.transcribir(datos, mime || m.mime);
    } catch (e) {
      console.error("No se pudo transcribir la nota de voz", e);
      return "(Mandó una nota de voz que no se pudo escuchar.)";
    }
  }
  return `(Mandó un mensaje de tipo ${m.descripcion}.)`;
}

/** Un familiar escribió al número de Acompaña: o es un recado para ella, o una pregunta para nosotros. */
async function procesarDeFamiliar(d: Deps, contacto: typeof contactos.$inferSelect, m: Entrante): Promise<"recado" | "familia"> {
  const [adulto] = await d.db.select().from(adultos).where(eq(adultos.familiaId, contacto.familiaId));
  const texto = await aTexto(d, m);
  await d.wa.marcarLeido(m.id);
  const deQuien = `${contacto.nombre} (${contacto.relacion})`;
  const recado = /^\s*recado\b[\s:,.-]*/i;
  if (adulto && recado.test(texto)) {
    const contenido = texto.replace(recado, "").trim();
    if (contenido) {
      await d.db.insert(recados).values({ adultoId: adulto.id, contactoId: contacto.id, deQuien, texto: contenido });
      await d.wa.enviarTexto(contacto.telefono, `Listo, ${contacto.nombre}. Se lo decimos a ${adulto.comoLlamarle} en su próxima plática y te contamos cómo lo recibió.`);
      return "recado";
    }
  }
  if (env.adminWhatsapp) {
    await d.wa.enviarPlantilla(env.adminWhatsapp, env.plantillaAvisoInterno, [limpiarParametro(`Mensaje de ${deQuien}${adulto ? `, familia de ${adulto.comoLlamarle}` : ""}: "${texto}". Contéstale desde WhatsApp: ${contacto.telefono}`)])
      .catch((e) => console.error("No se pudo reenviar el mensaje del familiar", e));
  }
  await d.wa.enviarTexto(
    contacto.telefono,
    `Gracias, ${contacto.nombre}. Lo leemos y te respondemos pronto.${adulto ? ` Si quieres que le pasemos un recado a ${adulto.comoLlamarle}, manda un mensaje o una nota de voz que empiece con la palabra "Recado".` : ""}`,
  );
  return "familia";
}

/** Procesa un mensaje que llegó por WhatsApp. */
export async function procesarEntrante(
  d: Deps, m: Entrante,
): Promise<"ignorado" | "duplicado" | "procesado" | "agrupado" | "recado" | "familia"> {
  const [adulto] = await d.db.select().from(adultos).where(eq(adultos.telefono, m.de));
  if (!adulto) {
    const [contacto] = await d.db.select().from(contactos).where(eq(contactos.telefono, m.de)).orderBy(asc(contactos.orden)).limit(1);
    return contacto ? procesarDeFamiliar(d, contacto, m) : "ignorado";
  }
  if (!adulto.activo) return "ignorado";

  const [yaVisto] = await d.db.select({ id: mensajes.id }).from(mensajes).where(eq(mensajes.waMessageId, m.id));
  if (yaVisto) return "duplicado";

  const ahora = d.ahora();
  const { fecha } = ahoraEnZona(adulto.zonaHoraria, ahora);

  // La plática de hoy (o una nueva si ella escribe primero)
  let [platica] = await d.db.select().from(platicas).where(and(eq(platicas.adultoId, adulto.id), eq(platicas.fecha, fecha)));
  if (!platica) {
    [platica] = await d.db.insert(platicas).values({ adultoId: adulto.id, fecha, estado: "en_curso", enviadaEn: ahora, ultimaActividadEn: ahora }).returning();
  }

  // Lo que dijo, en texto
  const texto = await aTexto(d, m);

  await d.db.insert(mensajes).values({ platicaId: platica.id, de: "adulto", tipo: m.tipo === "audio" ? "audio" : "texto", texto, waMessageId: m.id });
  // Si vuelve a escribir después de terminar (o de no contestar), la plática se reabre
  await d.db.update(platicas).set({ estado: "en_curso", ultimaActividadEn: ahora }).where(eq(platicas.id, platica.id));
  await d.wa.marcarLeido(m.id, true); // "escribiendo…"

  // Señales de alerta: reglas fijas + IA. Gana el nivel más alto.
  const senales = detectarSenales(texto);
  let nivelIA: Nivel = "verde";
  let motivoIA = "";
  let iaFallo = false;
  try {
    const c = await d.ia.clasificar(adulto.comoLlamarle, texto);
    nivelIA = c.nivel;
    motivoIA = c.motivo;
  } catch (e) {
    iaFallo = true;
    console.error("La clasificación por IA falló; se usan solo las reglas", e);
  }
  const nivel = nivelMaximo(nivelIA, ...senales.map((s) => s.nivel));
  if (nivel !== "verde") {
    const motivo = senales.find((s) => s.nivel === nivel)?.motivo ?? motivoIA ?? "Señal de alerta";
    // A la familia se le avisa de inmediato solo si la IA también lo ve rojo (o si la IA no respondió).
    // Si solo lo detectan las reglas, te llega a ti primero para que lo confirmes.
    const notificarFamilia = nivel === "rojo" && (iaFallo || nivelIA === "rojo");
    await crearAlerta(d, { adultoId: adulto.id, platicaId: platica.id, nivel, motivo: motivo || "Señal de alerta", frase: texto }, { notificarFamilia });
  }

  // Si manda varios mensajes seguidos, esperamos un momento y contestamos una sola vez a todos
  if (d.esperar) {
    await d.esperar(REGLAS.esperaParaAgrupar * 1000);
    const [ultimo] = await d.db.select({ waMessageId: mensajes.waMessageId }).from(mensajes)
      .where(and(eq(mensajes.platicaId, platica.id), eq(mensajes.de, "adulto")))
      .orderBy(desc(mensajes.creadoEn)).limit(1);
    if (ultimo && ultimo.waMessageId !== m.id) return "agrupado";
  }

  // Respuesta
  const perfil = await perfilDe(d.db, adulto.id, fecha);
  const historial = await historialDe(d.db, platica.id);
  let respuesta: { mensaje: string; terminar: boolean };
  try {
    respuesta = await d.ia.responder(perfil, historial);
  } catch (e) {
    console.error("La IA no pudo responder", e);
    respuesta = {
      mensaje: nivel === "rojo"
        ? `${adulto.comoLlamarle}, si es una emergencia, por favor llame al 911 o pida ayuda a alguien cercano ahorita. Ya le estoy avisando a su familia.`
        : `Disculpe, ${adulto.comoLlamarle}, se me fue la señal un momento. ¿Me lo repite, por favor?`,
      terminar: false,
    };
  }
  await decirle(d, adulto, platica.id, respuesta.mensaje);
  if (respuesta.terminar) await cerrarPlatica(d, platica.id);
  return "procesado";
}

/** Termina la plática y deja listo el resumen para que una persona lo revise. */
export async function cerrarPlatica(d: Deps, platicaId: string) {
  const [p] = await d.db.select().from(platicas).where(eq(platicas.id, platicaId));
  if (!p) return null;
  await d.db.update(platicas).set({ estado: "terminada", terminadaEn: d.ahora() }).where(eq(platicas.id, platicaId));

  const perfil = await perfilDe(d.db, p.adultoId, p.fecha);
  const historial = await historialDe(d.db, platicaId);
  const r = await d.ia.resumir(perfil, historial);

  // Si ya se había mandado un resumen de hoy, este se marca como actualización
  const [previo] = await d.db.select().from(resumenes).where(eq(resumenes.platicaId, platicaId));
  const textoBorrador = previo?.estado === "enviado" ? `Actualización: ${r.resumen}` : r.resumen;
  const valores = {
    platicaId, nivel: r.nivel, textoBorrador, datos: r.datos, memoria: r.memoria.join("\n"), estado: "pendiente" as const,
    textoFinal: null, revisadoPor: null, enviadoEn: null,
  };
  const [resumen] = await d.db.insert(resumenes).values(valores)
    .onConflictDoUpdate({ target: resumenes.platicaId, set: valores })
    .returning();

  // Los recados que ya existían cuando le hablamos por última vez quedan entregados
  const [ultimaRespuesta] = await d.db.select({ creadoEn: mensajes.creadoEn }).from(mensajes)
    .where(and(eq(mensajes.platicaId, platicaId), eq(mensajes.de, "acompana")))
    .orderBy(desc(mensajes.creadoEn)).limit(1);
  if (ultimaRespuesta && perfil.recados.length) {
    await d.db.update(recados).set({ entregadoEn: d.ahora(), platicaId })
      .where(and(eq(recados.adultoId, p.adultoId), isNull(recados.entregadoEn), lte(recados.creadoEn, ultimaRespuesta.creadoEn)));
  }
  return resumen;
}

/** Lo que pasa cuando no contestó en todo el día. */
async function marcarSinRespuesta(d: Deps, p: typeof platicas.$inferSelect, adulto: typeof adultos.$inferSelect) {
  await d.db.update(platicas).set({ estado: "sin_respuesta", terminadaEn: d.ahora() }).where(eq(platicas.id, p.id));
  const texto = `Hoy ${adulto.comoLlamarle} no contestó a ninguno de los ${p.intentos} saludos. Puede ser algo sencillo, como el teléfono sin batería o en silencio, pero te sugerimos llamarle o pedirle a alguien cercano que pase a verla.`;
  await d.db.insert(resumenes).values({
    platicaId: p.id, nivel: "amarillo", textoBorrador: texto, memoria: "",
    datos: { medicinaTomada: "no_se_sabe", animo: "no_se_sabe", comio: "no_se_sabe", temasDeSalud: [], cosasBonitas: [], pendientes: ["Confirmar que esté bien"] },
  }).onConflictDoNothing();
  await crearAlerta(d, { adultoId: adulto.id, platicaId: p.id, nivel: "amarillo", motivo: "No contestó en todo el día", frase: "" });
}

// ─── Programador ─────────────────────────────────────────────

/**
 * Se llama cada 5 minutos desde un cron.
 * Manda saludos a su hora, reintenta si no contestan y cierra pláticas que se quedaron a medias.
 */
export async function tick(d: Deps) {
  const ahora = d.ahora();
  const resultado = { saludos: 0, reintentos: 0, sinRespuesta: 0, cerradas: 0, errores: 0 };

  const activos = await d.db
    .select({ adulto: adultos })
    .from(adultos)
    .innerJoin(familias, eq(adultos.familiaId, familias.id))
    .where(and(eq(adultos.activo, true), inArray(familias.estado, ["prueba", "activa"])));

  for (const { adulto } of activos) {
    try {
      const local = ahoraEnZona(adulto.zonaHoraria, ahora);
      const [hoy] = await d.db.select().from(platicas).where(and(eq(platicas.adultoId, adulto.id), eq(platicas.fecha, local.fecha)));

      if (!hoy) {
        if (local.minutos >= minutosDeHora(adulto.horaSaludo)) {
          const [nueva] = await d.db.insert(platicas).values({ adultoId: adulto.id, fecha: local.fecha, enviadaEn: ahora, ultimaActividadEn: ahora })
            .onConflictDoNothing().returning();
          if (nueva) {
            await d.wa.enviarPlantilla(adulto.telefono, env.plantillaSaludo, [adulto.comoLlamarle]);
            await d.db.insert(mensajes).values({ platicaId: nueva.id, de: "acompana", tipo: "texto", texto: textoSaludo(adulto.comoLlamarle) });
            resultado.saludos++;
          }
        }
        continue;
      }

      if (hoy.estado === "enviada" && minutosEntre(hoy.ultimaActividadEn, ahora) >= REGLAS.reintentoSinRespuesta) {
        if (hoy.intentos < REGLAS.intentosMaximos) {
          await d.wa.enviarPlantilla(adulto.telefono, env.plantillaReintento, [adulto.comoLlamarle]);
          await d.db.insert(mensajes).values({ platicaId: hoy.id, de: "acompana", tipo: "texto", texto: textoReintento(adulto.comoLlamarle) });
          await d.db.update(platicas).set({ intentos: hoy.intentos + 1, ultimaActividadEn: ahora }).where(eq(platicas.id, hoy.id));
          resultado.reintentos++;
        } else {
          await marcarSinRespuesta(d, hoy, adulto);
          resultado.sinRespuesta++;
        }
        continue;
      }

      if (hoy.estado === "en_curso" && minutosEntre(hoy.ultimaActividadEn, ahora) >= REGLAS.cierrePorSilencio) {
        await cerrarPlatica(d, hoy.id);
        resultado.cerradas++;
      }
    } catch (e) {
      resultado.errores++;
      console.error(`Error en el programador con ${adulto.nombre}`, e);
    }
  }
  return resultado;
}

// ─── Envío a la familia ──────────────────────────────────────

/** Manda el resumen aprobado a la familia. Solo se llama desde el panel, después de revisarlo. */
export async function enviarResumen(d: Deps, resumenId: string, textoFinal: string, revisadoPor: string) {
  const [r] = await d.db.select().from(resumenes).where(eq(resumenes.id, resumenId));
  if (!r) throw new Error("No existe ese resumen.");
  if (r.estado === "enviado") return { enviados: 0, yaEnviado: true };
  const [p] = await d.db.select().from(platicas).where(eq(platicas.id, r.platicaId));
  const [a] = await d.db.select().from(adultos).where(eq(adultos.id, p.adultoId));
  const cs = await d.db.select().from(contactos).where(and(eq(contactos.familiaId, a.familiaId), eq(contactos.recibeResumen, true)));

  let enviados = 0;
  for (const c of cs) {
    try {
      await d.wa.enviarPlantilla(c.telefono, env.plantillaResumen, [a.comoLlamarle, fechaLarga(p.fecha), limpiarParametro(textoFinal)]);
      enviados++;
    } catch (e) {
      console.error(`No se pudo mandar el resumen a ${c.nombre}`, e);
    }
  }
  if (enviados === 0 && cs.length > 0) throw new Error("No se pudo mandar el resumen a ningún contacto. Revisa la plantilla de WhatsApp.");
  await d.db.update(resumenes).set({ estado: "enviado", textoFinal, revisadoPor, enviadoEn: d.ahora() }).where(eq(resumenes.id, resumenId));
  return { enviados, yaEnviado: false };
}
