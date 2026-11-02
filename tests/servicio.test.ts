import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { alertas, mensajes, platicas, resumenes } from "../src/lib/db/schema";
import { cerrarPlatica, enviarResumen, procesarEntrante, tick } from "../src/lib/acompana";
import { dbDePrueba, deps, reloj, sembrar } from "./ayudantes";
import type { Db } from "../src/lib/db/client";

process.env.ADMIN_WHATSAPP = "526180000000";

let db: Db;
let datos: Awaited<ReturnType<typeof sembrar>>;

beforeEach(async () => {
  db = await dbDePrueba();
  datos = await sembrar(db);
});

describe("programador diario", () => {
  it("manda el saludo a su hora local, no antes, y solo una vez", async () => {
    const r = reloj("2026-11-02T14:59:00Z"); // 8:59 en CDMX
    const d = deps(db, { ahora: r.ahora });
    expect((await tick(d)).saludos).toBe(0);
    r.fijar("2026-11-02T15:00:00Z"); // 9:00
    expect((await tick(d)).saludos).toBe(1);
    expect((await tick(d)).saludos).toBe(0);
    expect(d.wa.plantillas("saludo_diario")).toHaveLength(1);
    expect(d.wa.plantillas("saludo_diario")[0].parametros).toEqual(["Doña Rosa"]);
  });

  it("reintenta si no contesta y al tercer intento avisa que no contestó", async () => {
    const r = reloj("2026-11-02T15:00:00Z");
    const d = deps(db, { ahora: r.ahora });
    await tick(d);
    r.avanzarMinutos(120); expect((await tick(d)).reintentos).toBe(1);
    r.avanzarMinutos(120); expect((await tick(d)).reintentos).toBe(1);
    r.avanzarMinutos(120); expect((await tick(d)).sinRespuesta).toBe(1);
    expect(d.wa.plantillas("saludo_reintento")).toHaveLength(2);

    const [p] = await db.select().from(platicas);
    expect(p.estado).toBe("sin_respuesta");
    const [res] = await db.select().from(resumenes);
    expect(res.nivel).toBe("amarillo");
    expect(res.textoBorrador).toContain("no contestó");
    const [al] = await db.select().from(alertas);
    expect(al.motivo).toBe("No contestó en todo el día");
    expect(d.wa.plantillas("aviso_interno")).toHaveLength(1);
  });

  it("cierra y resume una plática que se quedó a medias", async () => {
    const r = reloj("2026-11-02T15:00:00Z");
    const d = deps(db, { ahora: r.ahora });
    await tick(d);
    r.avanzarMinutos(5);
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.a", texto: "Bien, gracias" });
    r.avanzarMinutos(31);
    expect((await tick(d)).cerradas).toBe(1);
    const [res] = await db.select().from(resumenes);
    expect(res.estado).toBe("enviado"); // día normal: sale solo
    expect(res.memoria).toBe("Mañana va al mercado");
  });

  it("no saluda a familias canceladas", async () => {
    const { familias } = await import("../src/lib/db/schema");
    await db.update(familias).set({ estado: "cancelada" });
    const d = deps(db, { ahora: () => new Date("2026-11-02T16:00:00Z") });
    expect((await tick(d)).saludos).toBe(0);
  });
});

describe("plática por WhatsApp", () => {
  it("entiende una nota de voz y responde con voz", async () => {
    const d = deps(db);
    d.voz.transcripcion = "Amanecí bien, ya regué mis plantas";
    const r = await procesarEntrante(d, { tipo: "audio", de: datos.adulto.telefono, id: "wamid.voz", mediaId: "m1", mime: "audio/ogg" });
    expect(r).toBe("procesado");
    const ms = await db.select().from(mensajes);
    expect(ms.map((m) => m.de)).toEqual(["adulto", "acompana"]);
    expect(ms[0].texto).toBe("Amanecí bien, ya regué mis plantas");
    expect(d.wa.enviados.at(-1)?.tipo).toBe("audio");
    expect(d.ia.ultimoPerfil?.medicinas[0].nombre).toBe("Losartán");
    expect(d.ia.ultimoPerfil?.nombreFamiliar).toBe("Juan (hijo)");
  });

  it("si la voz falla, responde por texto", async () => {
    const d = deps(db);
    d.voz.sintetizar = async () => { throw new Error("sin voz"); };
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.t", texto: "Hola" });
    expect(d.wa.enviados.at(-1)?.tipo).toBe("texto");
  });

  it("ignora mensajes repetidos y números desconocidos", async () => {
    const d = deps(db);
    const m = { tipo: "texto" as const, de: datos.adulto.telefono, id: "wamid.rep", texto: "Hola" };
    expect(await procesarEntrante(d, m)).toBe("procesado");
    expect(await procesarEntrante(d, m)).toBe("duplicado");
    expect(await procesarEntrante(d, { ...m, id: "wamid.otro", de: "520000000000" })).toBe("ignorado");
  });

  it("alerta roja confirmada por la IA: avisa a ti y a toda la familia de inmediato", async () => {
    const d = deps(db);
    d.ia.clasificacion = { nivel: "rojo", motivo: "Caída" };
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.r", texto: "Me caí y no me puedo levantar" });
    const [al] = await db.select().from(alertas);
    expect(al.nivel).toBe("rojo");
    expect(d.wa.plantillas("aviso_interno")).toHaveLength(1);
    expect(d.wa.plantillas("alerta_familia").map((e) => e.para).sort()).toEqual(["13105551234", "526181112233"]);
  });

  it("si solo las reglas lo ven rojo, te avisa a ti primero y no a la familia", async () => {
    const d = deps(db);
    d.ia.clasificacion = { nivel: "verde", motivo: "" };
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.r2", texto: "Ayer me caí pero ya estoy bien" });
    const [al] = await db.select().from(alertas);
    expect(al.nivel).toBe("rojo");
    expect(d.wa.plantillas("aviso_interno")).toHaveLength(1);
    expect(d.wa.plantillas("alerta_familia")).toHaveLength(0);
  });

  it("si la IA no responde, las reglas siguen protegiendo y la familia se entera", async () => {
    const d = deps(db);
    d.ia.fallarClasificacion = true;
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.r3", texto: "Me duele mucho el pecho" });
    expect(d.wa.plantillas("alerta_familia")).toHaveLength(2);
  });

  it("alerta amarilla: solo te avisa a ti; la familia lo verá en el resumen", async () => {
    const d = deps(db);
    d.ia.clasificacion = { nivel: "amarillo", motivo: "Posible fraude" };
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.y", texto: "Me llamaron del banco" });
    expect(d.wa.plantillas("aviso_interno")).toHaveLength(1);
    expect(d.wa.plantillas("alerta_familia")).toHaveLength(0);
  });

  it("no repite la misma alerta en la misma plática", async () => {
    const d = deps(db);
    d.ia.clasificacion = { nivel: "amarillo", motivo: "Dolor" };
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.d1", texto: "Me duele la rodilla" });
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.d2", texto: "Sí, me duele bastante" });
    expect(await db.select().from(alertas)).toHaveLength(1);
  });

  it("cuando la IA se despide, la plática se cierra y el resumen de un día normal sale solo", async () => {
    const d = deps(db);
    d.ia.respuesta = { mensaje: "Que tenga bonito día, Doña Rosa.", terminar: true };
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.bye", texto: "Bueno, ya me voy" });
    const [p] = await db.select().from(platicas);
    expect(p.estado).toBe("terminada");
    expect((await db.select().from(resumenes))[0].estado).toBe("enviado");
  });
});

describe("resumen para la familia", () => {
  it("un día normal sale solo: aviso corto por WhatsApp y el resumen completo en la página", async () => {
    const d = deps(db);
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.s", texto: "Bien" });
    const [p] = await db.select().from(platicas);
    const r = await cerrarPlatica(d, p.id);
    expect(r!.estado).toBe("enviado");
    expect(r!.revisadoPor).toBe("automático");
    expect(r!.textoFinal).toContain("Todo tranquilo");
    const envios = d.wa.plantillas("resumen_diario");
    expect(envios).toHaveLength(1); // solo a quien recibe resúmenes
    expect(envios[0].para).toBe("13105551234");
    const { familias } = await import("../src/lib/db/schema");
    const [fam] = await db.select().from(familias);
    expect(envios[0].parametros).toEqual(["Doña Rosa", "lunes 2 de noviembre", "Amaneció bien y platicó un rato.", fam.tokenPagina]);
    expect((await enviarResumen(d, r!.id, "otra vez", "Daniel")).yaEnviado).toBe(true);
  });

  it("lo delicado espera revisión; si lo corriges, el aviso sale de tu versión", async () => {
    const d = deps(db);
    d.ia.nivelResumen = "amarillo";
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.s2", texto: "Me duele la rodilla" });
    const [p] = await db.select().from(platicas);
    const r = await cerrarPlatica(d, p.id);
    expect(r!.estado).toBe("pendiente");
    expect(d.wa.plantillas("resumen_diario")).toHaveLength(0);

    const largo = "Hoy le dolió la rodilla y casi no caminó. Dice que es por el frío. Regó sus plantas y vio la novela. Si puedes, llámale en la tarde para ver cómo sigue y si quiere ir al doctor esta semana.";
    const res = await enviarResumen(d, r!.id, largo, "Daniel");
    expect(res.enviados).toBe(1);
    const aviso = d.wa.plantillas("resumen_diario")[0].parametros![2];
    expect(aviso.length).toBeLessThanOrEqual(220);
    expect(aviso.startsWith("Hoy le dolió la rodilla")).toBe(true);
    const [guardado] = await db.select().from(resumenes).where(eq(resumenes.id, r!.id));
    expect(guardado.revisadoPor).toBe("Daniel");
    expect(guardado.textoFinal).toBe(largo);
  });

  it("si la familia pidió solo lo importante, un día normal queda en la página sin mandar mensaje", async () => {
    const { familias } = await import("../src/lib/db/schema");
    await db.update(familias).set({ avisos: "importante" });
    const d = deps(db);
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.i1", texto: "Bien" });
    const [p] = await db.select().from(platicas);
    const r = await cerrarPlatica(d, p.id);
    expect(r!.estado).toBe("enviado");
    expect(d.wa.plantillas("resumen_diario")).toHaveLength(0);

    // Algo importante sí llega
    d.ia.importante = true;
    d.ia.aviso = "Le contó que el doctor le cambió la pastilla.";
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.i2", texto: "Oiga, el doctor me cambió la pastilla" });
    await cerrarPlatica(d, p.id);
    expect(d.wa.plantillas("resumen_diario")[0].parametros![2]).toBe("Actualización: Le contó que el doctor le cambió la pastilla.");
  });

  it("la memoria de ayer llega a la plática de hoy", async () => {
    const r = reloj("2026-11-02T15:00:00Z");
    const d = deps(db, { ahora: r.ahora });
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.m1", texto: "Mañana voy al mercado" });
    const [p] = await db.select().from(platicas);
    await cerrarPlatica(d, p.id);
    r.fijar("2026-11-03T15:30:00Z");
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.m2", texto: "Buenos días" });
    expect(d.ia.ultimoPerfil?.memoria.join(" ")).toContain("Mañana va al mercado");
  });
});

describe("mejoras de la plática", () => {
  it("muestra 'escribiendo…' mientras prepara la respuesta", async () => {
    const d = deps(db);
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.esc", texto: "Hola" });
    expect(d.wa.leidos).toContainEqual({ id: "wamid.esc", escribiendo: true });
  });

  it("si manda varios mensajes seguidos, contesta una sola vez a todos", async () => {
    const d = deps(db);
    let liberar: () => void = () => {};
    const pausa = new Promise<void>((r) => { liberar = r; });
    let llamadas = 0;
    d.esperar = async () => { llamadas++; if (llamadas === 1) await pausa; };
    const primero = procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.g1", texto: "Buenos días" });
    await new Promise((r) => setTimeout(r, 50));
    const segundo = await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.g2", texto: "Ya me tomé la pastilla" });
    liberar();
    expect(await primero).toBe("agrupado");
    expect(segundo).toBe("procesado");
    const respuestas = (await db.select().from(mensajes)).filter((x) => x.de === "acompana");
    expect(respuestas).toHaveLength(1);
    expect(d.ia.ultimoHistorial.map((t) => t.texto)).toEqual(["Buenos días", "Ya me tomé la pastilla"]);
  });

  it("si escribe después de terminar la plática, se reabre y se le contesta", async () => {
    const d = deps(db);
    d.ia.respuesta = { mensaje: "Que le vaya bonito.", terminar: true };
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.c1", texto: "Ya me voy" });
    d.ia.respuesta = { mensaje: "¡Qué gusto! Cuénteme.", terminar: false };
    expect(await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.c2", texto: "Oiga, se me olvidó contarle algo" })).toBe("procesado");
    const [p] = await db.select().from(platicas);
    expect(p.estado).toBe("en_curso");
  });

  it("si el resumen de hoy ya se envió y la plática sigue, el nuevo queda como actualización", async () => {
    const d = deps(db);
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.u1", texto: "Bien" });
    const [p] = await db.select().from(platicas);
    const r = await cerrarPlatica(d, p.id);
    expect(r!.estado).toBe("enviado");
    d.ia.nivelResumen = "amarillo";
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.u2", texto: "Oiga, me duele la cabeza" });
    const nuevo = await cerrarPlatica(d, p.id);
    expect(nuevo!.estado).toBe("pendiente");
    expect(nuevo!.textoBorrador.startsWith("Actualización:")).toBe(true);
    expect(nuevo!.textoFinal).toBeNull();
  });
});

describe("mensajes de la familia", () => {
  it("un recado se guarda, se le dice a ella en la siguiente plática y queda entregado", async () => {
    const d = deps(db);
    const r = await procesarEntrante(d, { tipo: "texto", de: "13105551234", id: "wamid.f1", texto: "Recado: que el domingo voy a comer con los niños" });
    expect(r).toBe("recado");
    expect(d.wa.textosA("13105551234")[0]).toContain("Se lo decimos a Doña Rosa");

    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.f2", texto: "Buenos días" });
    expect(d.ia.ultimoPerfil?.recados).toEqual(["Juan (hijo): que el domingo voy a comer con los niños"]);

    const [p] = await db.select().from(platicas);
    await cerrarPlatica(d, p.id);
    const { recados } = await import("../src/lib/db/schema");
    const [rec] = await db.select().from(recados);
    expect(rec.entregadoEn).not.toBeNull();

    // Al día siguiente ya no se repite
    await procesarEntrante({ ...d, ahora: () => new Date("2026-11-03T15:30:00Z") }, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.f3", texto: "Hola" });
    expect(d.ia.ultimoPerfil?.recados).toEqual([]);
  });

  it("la familia elige por WhatsApp si quiere el resumen diario o solo lo importante", async () => {
    const { familias } = await import("../src/lib/db/schema");
    const d = deps(db);
    expect(await procesarEntrante(d, { tipo: "texto", de: "13105551234", id: "wamid.p1", texto: "Solo lo importante, por favor" })).toBe("avisos");
    expect((await db.select().from(familias))[0].avisos).toBe("importante");
    expect(d.wa.textosA("13105551234")[0]).toContain("solo te escribimos cuando haya algo importante");
    expect(await procesarEntrante(d, { tipo: "texto", de: "13105551234", id: "wamid.p2", texto: "Todos los días" })).toBe("avisos");
    expect((await db.select().from(familias))[0].avisos).toBe("diario");
    // Una pregunta que menciona "todos los días" no cambia nada
    expect(await procesarEntrante(d, { tipo: "texto", de: "13105551234", id: "wamid.p3", texto: "¿Se toma su pastilla todos los días?" })).toBe("estado");
    expect((await db.select().from(familias))[0].avisos).toBe("diario");
  });

  it("una pregunta de la familia te llega a ti y se le contesta con cortesía", async () => {
    const d = deps(db);
    const r = await procesarEntrante(d, { tipo: "texto", de: "13105551234", id: "wamid.f4", texto: "¿Cómo cambio la hora del saludo?" });
    expect(r).toBe("familia");
    expect(d.wa.plantillas("aviso_interno")[0].parametros?.[0]).toContain("¿Cómo cambio la hora del saludo?");
    expect(d.wa.textosA("13105551234")[0]).toContain('empiece con la palabra "Recado"');
  });
});
