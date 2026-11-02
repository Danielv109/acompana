/**
 * "Lo último de mamá": su gente, sus citas, sus medicinas e historias.
 * Aquí vive lo que se guarda de cada plática y los recordatorios que le llegan al hijo.
 */
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, ne } from "drizzle-orm";
import type { Db } from "./db/client";
import {
  adultos, citas, contactos, familias, historias, medicinas, mensajes, personas, platicas, resumenes, nuevoToken,
} from "./db/schema";
import type { Deps } from "./acompana";
import type { ResultadoResumen } from "./ai/ia";
import { PREGUNTAS_HISTORIA } from "./ai/instrucciones";
import { cuandoEs, diasEntre, fechaLarga, sumarDias } from "./tiempo";
import { env } from "./env";
import { limpiarParametro } from "./whatsapp/plantillas";

export const RECORDATORIOS = {
  diasAntesDeAcabarse: 5, // aviso al hijo cuando a una medicina le quedan 5 días o menos
  diasAntesDeCumpleanos: 2,
  horasDespuesDeLaCita: 3, // después de su cita, se le pregunta cómo le fue
  diasEntreHistorias: 4, // cada cuántos días se le propone contar una historia
  diasQueSeGuardanLosAudios: 30,
  ventanaWhatsAppHoras: 23, // para escribirle primero sin plantilla
};

// ─── Medicinas ───────────────────────────────────────────────

/** Días que le quedan a una medicina, o null si la familia no ha dicho cuándo la surtió y cuánto dura. */
export function diasRestantes(m: { ultimoSurtido: string | null; duraDias: number | null }, hoy: string): number | null {
  if (!m.ultimoSurtido || !m.duraDias) return null;
  return m.duraDias - diasEntre(m.ultimoSurtido, hoy);
}

export function textoDiasRestantes(n: number | null): string {
  if (n === null) return "sin datos de surtido";
  if (n < 0) return `se acabó hace ${-n} ${-n === 1 ? "día" : "días"}`;
  if (n === 0) return "se acaba hoy";
  return `le ${n === 1 ? "queda 1 día" : `quedan ${n} días`}`;
}

// ─── Contexto para la plática ────────────────────────────────

export async function contextoFicha(db: Db, adultoId: string, hoy: string) {
  const gente = await db.select().from(personas).where(eq(personas.adultoId, adultoId)).orderBy(desc(personas.actualizadoEn)).limit(15);

  const recientes = await db.select().from(citas).where(and(
    eq(citas.adultoId, adultoId), gte(citas.fecha, sumarDias(hoy, -3)), lte(citas.fecha, sumarDias(hoy, 1)),
  )).orderBy(asc(citas.fecha));

  const temas: string[] = [];
  const citasPorPreguntar: Array<{ id: string; texto: string }> = [];
  for (const c of recientes) {
    const cuando = cuandoEs(c.fecha, hoy);
    if (c.fecha > hoy) {
      temas.push(`${cap(cuando)} tiene cita con ${c.conQuien}${c.hora ? ` a las ${c.hora}` : ""}. Puedes desearle que le vaya bien, sin insistir.`);
    } else if (!c.loQueConto && c.seguimiento !== "hecho") {
      temas.push(`${cap(cuando)} tuvo cita con ${c.conQuien}. Pregúntale con interés cómo le fue y qué le dijo el doctor.`);
      citasPorPreguntar.push({ id: c.id, texto: `${cap(cuando)}: ${c.conQuien}` });
    }
  }

  const [ultima] = await db.select({ creadaEn: historias.creadaEn }).from(historias)
    .where(eq(historias.adultoId, adultoId)).orderBy(desc(historias.creadaEn)).limit(1);
  const totalHistorias = (await db.select({ id: historias.id }).from(historias).where(eq(historias.adultoId, adultoId))).length;
  const toca = !ultima || diasEntre(ultima.creadaEn.toISOString().slice(0, 10), hoy) >= RECORDATORIOS.diasEntreHistorias;
  const preguntaHistoria = toca ? PREGUNTAS_HISTORIA[(totalHistorias + diasEntre("2026-01-01", hoy)) % PREGUNTAS_HISTORIA.length] : null;

  return {
    personas: gente.map((p) => `${p.nombre}${p.relacion ? ` (${p.relacion})` : ""}${p.notas ? `: ${p.notas}` : ""}`),
    temas,
    preguntaHistoria,
    citasPorPreguntar,
  };
}

function cap(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ─── Lo que se guarda al terminar la plática ─────────────────

type FilaMensaje = typeof mensajes.$inferSelect;

export async function guardarLoImportante(
  d: Deps, adultoId: string, platicaId: string, filas: FilaMensaje[], r: ResultadoResumen,
  citasPorPreguntar: Array<{ id: string }>,
) {
  // Su gente: se actualiza lo último que contó de cada quien
  for (const p of r.personas) {
    const nombre = p.nombre.trim().slice(0, 60);
    const cumpleanos = /^\d{2}-\d{2}$/.test(p.cumpleanos ?? "") ? p.cumpleanos! : null;
    await d.db.insert(personas).values({ adultoId, nombre, relacion: p.relacion.slice(0, 40), notas: p.nota.slice(0, 300), cumpleanos, actualizadoEn: d.ahora() })
      .onConflictDoUpdate({
        target: [personas.adultoId, personas.nombre],
        set: { notas: p.nota.slice(0, 300), actualizadoEn: d.ahora(), ...(p.relacion ? { relacion: p.relacion.slice(0, 40) } : {}), ...(cumpleanos ? { cumpleanos } : {}) },
      });
  }

  // Lo que contó del doctor queda en la cita más reciente que estaba pendiente
  if (r.loQueContoDelDoctor && citasPorPreguntar.length) {
    const ultima = citasPorPreguntar.at(-1)!;
    await d.db.update(citas).set({ loQueConto: r.loQueContoDelDoctor, seguimiento: "hecho" }).where(eq(citas.id, ultima.id));
  }

  // Su historia, con su voz (solo si dio permiso; la IA solo la devuelve en ese caso)
  if (r.historia) {
    const audios = r.historia.mensajes
      .map((n) => filas.at(n - 1))
      .filter((m): m is FilaMensaje => Boolean(m && m.de === "adulto" && m.audio))
      .map((m) => ({ mime: m.audioMime ?? "audio/ogg", base64: m.audio!.toString("base64") }));
    await d.db.insert(historias).values({ adultoId, platicaId, titulo: r.historia.titulo.slice(0, 120), texto: r.historia.texto, audios });
  }
}

/** Las notas de voz se borran a los 30 días; las de historias quedan guardadas en su historia. */
export async function borrarAudiosViejos(d: Deps) {
  const limite = new Date(d.ahora().getTime() - RECORDATORIOS.diasQueSeGuardanLosAudios * 86400000);
  await d.db.update(mensajes).set({ audio: null }).where(and(isNotNull(mensajes.audio), lt(mensajes.creadoEn, limite)));
}

// ─── Recordatorios para el hijo ──────────────────────────────

async function avisarFamilia(d: Deps, familiaId: string, comoLlamarle: string, texto: string) {
  const cs = await d.db.select().from(contactos).where(and(eq(contactos.familiaId, familiaId), eq(contactos.recibeResumen, true)));
  let enviados = 0;
  for (const c of cs) {
    try {
      await d.wa.enviarPlantilla(c.telefono, env.plantillaRecordatorio, [comoLlamarle, limpiarParametro(texto, 600)]);
      enviados++;
    } catch (e) {
      console.error(`No se pudo mandar el recordatorio a ${c.nombre}`, e);
    }
  }
  return enviados;
}

/** Se revisa una vez por plática diaria: medicinas por acabarse, citas de mañana, cumpleaños de su gente. */
export async function recordatoriosFamilia(d: Deps, adulto: typeof adultos.$inferSelect, hoy: string) {
  let enviados = 0;

  for (const m of await d.db.select().from(medicinas).where(eq(medicinas.adultoId, adulto.id))) {
    const quedan = diasRestantes(m, hoy);
    if (quedan === null || quedan > RECORDATORIOS.diasAntesDeAcabarse) continue;
    const yaAvisado = m.recordadoEn && m.ultimoSurtido && m.recordadoEn.toISOString().slice(0, 10) >= m.ultimoSurtido;
    if (yaAvisado) continue;
    const texto = quedan <= 0
      ? `según lo que registraste, el ${m.nombre} ya se le terminó. Si ya se lo surtieron, márcalo en su página para que la cuenta empiece de nuevo.`
      : `al ${m.nombre} le ${quedan === 1 ? "queda 1 día" : `quedan unos ${quedan} días`}. ¿Ya tienes quién se lo surta? Cuando lo tenga, márcalo en su página.`;
    if (await avisarFamilia(d, adulto.familiaId, adulto.comoLlamarle, texto)) {
      await d.db.update(medicinas).set({ recordadoEn: d.ahora() }).where(eq(medicinas.id, m.id));
      enviados++;
    }
  }

  const manana = sumarDias(hoy, 1);
  for (const c of await d.db.select().from(citas).where(and(eq(citas.adultoId, adulto.id), eq(citas.fecha, manana), isNull(citas.recordatorioEnviadoEn)))) {
    const texto = `mañana tiene cita con ${c.conQuien}${c.hora ? ` a las ${c.hora}` : ""}${c.lugar ? ` en ${c.lugar}` : ""}. Después le preguntamos cómo le fue y te contamos.`;
    if (await avisarFamilia(d, adulto.familiaId, adulto.comoLlamarle, texto)) {
      await d.db.update(citas).set({ recordatorioEnviadoEn: d.ahora() }).where(eq(citas.id, c.id));
      enviados++;
    }
  }

  const anio = Number(hoy.slice(0, 4));
  const objetivo = sumarDias(hoy, RECORDATORIOS.diasAntesDeCumpleanos).slice(5);
  for (const p of await d.db.select().from(personas).where(and(eq(personas.adultoId, adulto.id), eq(personas.cumpleanos, objetivo)))) {
    if (p.recordadoAnio === anio) continue;
    const texto = `en ${RECORDATORIOS.diasAntesDeCumpleanos} días es el cumpleaños de ${p.nombre}${p.relacion ? ` (${p.relacion})` : ""}. Seguro le da gusto que se lo recuerdes o que le marquen juntos.`;
    if (await avisarFamilia(d, adulto.familiaId, adulto.comoLlamarle, texto)) {
      await d.db.update(personas).set({ recordadoAnio: anio }).where(eq(personas.id, p.id));
      enviados++;
    }
  }
  return enviados;
}

// ─── Lo que se le responde al hijo cuando pregunta ───────────

export async function asegurarToken(db: Db, familiaId: string): Promise<string> {
  const [f] = await db.select({ token: familias.tokenPagina }).from(familias).where(eq(familias.id, familiaId));
  if (f?.token) return f.token;
  const token = nuevoToken();
  await db.update(familias).set({ tokenPagina: token }).where(eq(familias.id, familiaId));
  return token;
}

export function enlacePagina(token: string): string {
  return `${env.appUrl}/mama/${token}`;
}

/** Texto corto con lo último: cómo está, medicinas y próxima cita. */
export async function estadoParaFamilia(db: Db, adulto: typeof adultos.$inferSelect, hoy: string): Promise<string> {
  const [ultimo] = await db.select({ texto: resumenes.textoFinal, fecha: platicas.fecha }).from(resumenes)
    .innerJoin(platicas, eq(resumenes.platicaId, platicas.id))
    .where(and(eq(platicas.adultoId, adulto.id), eq(resumenes.estado, "enviado")))
    .orderBy(desc(platicas.fecha)).limit(1);
  const meds = await db.select().from(medicinas).where(eq(medicinas.adultoId, adulto.id));
  const [proxima] = await db.select().from(citas).where(and(eq(citas.adultoId, adulto.id), gte(citas.fecha, hoy))).orderBy(asc(citas.fecha)).limit(1);
  const token = await asegurarToken(db, adulto.familiaId);

  const partes = [`Lo último de ${adulto.comoLlamarle}:`];
  partes.push(ultimo?.texto ? `${cap(cuandoEs(ultimo.fecha, hoy))}: ${ultimo.texto}` : "Todavía no hay un resumen enviado.");
  const conDatos = meds.map((m) => ({ m, n: diasRestantes(m, hoy) })).filter((x) => x.n !== null);
  if (conDatos.length) partes.push(`Medicinas: ${conDatos.map(({ m, n }) => `${m.nombre} (${textoDiasRestantes(n)})`).join(", ")}.`);
  if (proxima) partes.push(`Próxima cita: ${cuandoEs(proxima.fecha, hoy)}${proxima.hora ? ` a las ${proxima.hora}` : ""} con ${proxima.conQuien}.`);
  partes.push(`Todo lo demás, en su página: ${enlacePagina(token)}`);
  return partes.join("\n\n");
}

/** Citas de hoy cuya hora + 3 h ya pasó y que todavía no tienen seguimiento. */
export async function citasParaSeguimiento(db: Db, adultoId: string, hoy: string, minutosAhora: number) {
  const deHoy = await db.select().from(citas).where(and(
    eq(citas.adultoId, adultoId), eq(citas.fecha, hoy), eq(citas.seguimiento, "pendiente"), ne(citas.hora, ""),
  ));
  return deHoy.filter((c) => {
    const [h, m] = c.hora.split(":").map(Number);
    return minutosAhora >= h * 60 + m + RECORDATORIOS.horasDespuesDeLaCita * 60;
  });
}

/** ¿Podemos escribirle sin plantilla? Solo si ella escribió en las últimas 23 horas. */
export async function ventanaAbierta(db: Db, adultoId: string, ahora: Date): Promise<boolean> {
  const desde = new Date(ahora.getTime() - RECORDATORIOS.ventanaWhatsAppHoras * 3600000);
  // ultimaActividadEn se mueve cuando ella escribe (los reintentos solo la mueven si nunca contestó)
  const recientes = await db.select({ id: platicas.id }).from(platicas)
    .where(and(eq(platicas.adultoId, adultoId), gte(platicas.ultimaActividadEn, desde), ne(platicas.estado, "enviada"), ne(platicas.estado, "sin_respuesta")));
  if (!recientes.length) return false;
  const [deElla] = await db.select({ id: mensajes.id }).from(mensajes)
    .where(and(inArray(mensajes.platicaId, recientes.map((r) => r.id)), eq(mensajes.de, "adulto"))).limit(1);
  return Boolean(deElla);
}
