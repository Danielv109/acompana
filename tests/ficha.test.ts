import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { citas, contactos, familias, historias, medicinas, mensajes, personas, platicas } from "../src/lib/db/schema";
import { cerrarPlatica, procesarEntrante, tick } from "../src/lib/acompana";
import { diasRestantes, estadoParaFamilia, recordatoriosFamilia } from "../src/lib/ficha";
import { dbDePrueba, deps, reloj, sembrar } from "./ayudantes";
import type { Db } from "../src/lib/db/client";

process.env.ADMIN_WHATSAPP = "526180000000";
process.env.APP_URL = "https://acompana.mx";

let db: Db;
let datos: Awaited<ReturnType<typeof sembrar>>;

beforeEach(async () => {
  db = await dbDePrueba();
  datos = await sembrar(db);
});

describe("medicinas: los recordatorios son para el hijo, nunca para ella", () => {
  it("calcula los días que le quedan", () => {
    expect(diasRestantes({ ultimoSurtido: "2026-10-10", duraDias: 30 }, "2026-11-02")).toBe(7);
    expect(diasRestantes({ ultimoSurtido: null, duraDias: 30 }, "2026-11-02")).toBeNull();
  });

  it("avisa al hijo una sola vez cuando quedan 5 días o menos, y vuelve a contar al surtirla", async () => {
    const d = deps(db);
    await db.update(medicinas).set({ ultimoSurtido: "2026-10-05", duraDias: 30 }); // le quedan 2 días
    expect(await recordatoriosFamilia(d, datos.adulto, "2026-11-02")).toBe(1);
    const aviso = d.wa.plantillas("recordatorio_familia")[0];
    expect(aviso.para).toBe("13105551234"); // al hijo
    expect(aviso.parametros?.[1]).toContain("Losartán");
    expect(d.wa.enviados.some((e) => e.para === datos.adulto.telefono)).toBe(false); // a ella nada

    expect(await recordatoriosFamilia(d, datos.adulto, "2026-11-03")).toBe(0); // no se repite

    await db.update(medicinas).set({ ultimoSurtido: "2026-11-04" }); // la surtieron
    expect(await recordatoriosFamilia(d, datos.adulto, "2026-11-05")).toBe(0);
    expect(await recordatoriosFamilia(d, datos.adulto, "2026-11-30")).toBe(1); // nuevo ciclo
  });

  it("la IA nunca recibe instrucciones de hablarle de surtir medicinas", async () => {
    const { instruccionesPlatica } = await import("../src/lib/ai/instrucciones");
    const texto = instruccionesPlatica({
      nombre: "Rosa", comoLlamarle: "Doña Rosa", sobreElla: "", medicinas: [], memoria: [], fechaLarga: "lunes",
      nombreFamiliar: "Juan", recados: [], personas: [], temas: [], preguntaHistoria: null,
    });
    expect(texto).toContain("Nunca le hablas de que se le está acabando una medicina");
  });
});

describe("citas registradas por el hijo", () => {
  it("le recuerda al hijo un día antes", async () => {
    const d = deps(db);
    await db.insert(citas).values({ adultoId: datos.adulto.id, fecha: "2026-11-03", hora: "10:00", conQuien: "Cardiólogo" });
    expect(await recordatoriosFamilia(d, datos.adulto, "2026-11-02")).toBe(1);
    expect(d.wa.plantillas("recordatorio_familia")[0].parametros?.[1]).toContain("mañana tiene cita con Cardiólogo a las 10:00");
    expect(await recordatoriosFamilia(d, datos.adulto, "2026-11-02")).toBe(0);
  });

  it("3 horas después de la cita le pregunta amablemente cómo le fue, si puede escribirle", async () => {
    const r = reloj("2026-11-02T15:30:00Z"); // 9:30 CDMX
    const d = deps(db, { ahora: r.ahora });
    await db.insert(citas).values({ adultoId: datos.adulto.id, fecha: "2026-11-02", hora: "10:00", conQuien: "Cardiólogo" });
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.c1", texto: "Ya me voy a mi cita" });
    r.fijar("2026-11-02T18:59:00Z"); // 12:59: todavía no
    expect((await tick(d)).seguimientos).toBe(0);
    r.fijar("2026-11-02T19:01:00Z"); // 13:01
    expect((await tick(d)).seguimientos).toBe(1);
    expect(d.ia.iniciados[0]).toContain("Cardiólogo");
    expect((await tick(d)).seguimientos).toBe(0);
  });

  it("si no puede escribirle (no ha contestado en 23 h), lo deja como tema para la siguiente plática", async () => {
    const d = deps(db, { ahora: () => new Date("2026-11-02T20:00:00Z") });
    await db.insert(citas).values({ adultoId: datos.adulto.id, fecha: "2026-11-02", hora: "10:00", conQuien: "Cardiólogo" });
    expect((await tick(d)).seguimientos).toBe(0);
    await procesarEntrante({ ...d, ahora: () => new Date("2026-11-03T15:00:00Z") }, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.c2", texto: "Buenos días" });
    expect(d.ia.ultimoPerfil?.temas.join(" ")).toContain("Ayer tuvo cita con Cardiólogo");
  });

  it("lo que contó del doctor queda guardado en la cita", async () => {
    const d = deps(db);
    const [cita] = await db.insert(citas).values({ adultoId: datos.adulto.id, fecha: "2026-11-01", hora: "10:00", conQuien: "Cardiólogo" }).returning();
    d.ia.loQueConto = "Que todo va bien, pero que camine más";
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.c3", texto: "El doctor dijo que todo bien" });
    const [p] = await db.select().from(platicas);
    await cerrarPlatica(d, p.id);
    expect(d.ia.ultimoContextoResumen?.citasPorPreguntar[0]).toContain("Cardiólogo");
    const [guardada] = await db.select().from(citas).where(eq(citas.id, cita.id));
    expect(guardada.loQueConto).toBe("Que todo va bien, pero que camine más");
    expect(guardada.seguimiento).toBe("hecho");
  });
});

describe("su gente y sus historias", () => {
  it("se acuerda de su gente y actualiza el último chisme", async () => {
    const d = deps(db);
    d.ia.personas = [{ nombre: "Chela", relacion: "comadre", nota: "su nieto se casa en diciembre", cumpleanos: "11-04" }];
    await procesarEntrante(d, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.p1", texto: "Mi comadre Chela..." });
    let [p] = await db.select().from(platicas);
    await cerrarPlatica(d, p.id);
    d.ia.personas = [{ nombre: "Chela", relacion: "", nota: "ya tiene vestido para la boda" }];
    const d2 = { ...d, ahora: () => new Date("2026-11-03T15:30:00Z") };
    await procesarEntrante(d2, { tipo: "texto", de: datos.adulto.telefono, id: "wamid.p2", texto: "Hola" });
    expect(d.ia.ultimoPerfil?.personas[0]).toBe("Chela (comadre): su nieto se casa en diciembre");
    [p] = await db.select().from(platicas).where(eq(platicas.fecha, "2026-11-03"));
    await cerrarPlatica(d2, p.id);
    const [chela] = await db.select().from(personas);
    expect(chela.notas).toBe("ya tiene vestido para la boda");
    expect(chela.relacion).toBe("comadre");
    expect(chela.cumpleanos).toBe("11-04");
  });

  it("recuerda al hijo el cumpleaños de su gente 2 días antes", async () => {
    const d = deps(db);
    await db.insert(personas).values({ adultoId: datos.adulto.id, nombre: "Chela", relacion: "comadre", cumpleanos: "11-04" });
    expect(await recordatoriosFamilia(d, datos.adulto, "2026-11-02")).toBe(1);
    expect(d.wa.plantillas("recordatorio_familia")[0].parametros?.[1]).toContain("cumpleaños de Chela");
    expect(await recordatoriosFamilia(d, datos.adulto, "2026-11-02")).toBe(0);
  });

  it("guarda la historia con su voz solo cuando la IA confirma su permiso", async () => {
    const d = deps(db);
    d.voz.transcripcion = "A mi viejo lo conocí en la feria de San Juan";
    await procesarEntrante(d, { tipo: "audio", de: datos.adulto.telefono, id: "wamid.h1", mediaId: "m1", mime: "audio/ogg" });
    const [p] = await db.select().from(platicas);
    d.ia.historia = { titulo: "Cómo conocí a mi viejo", texto: "A mi viejo lo conocí en la feria de San Juan", mensajes: [1] };
    await cerrarPlatica(d, p.id);
    const [h] = await db.select().from(historias);
    expect(h.titulo).toBe("Cómo conocí a mi viejo");
    expect(h.audios).toHaveLength(1);
    expect(Buffer.from(h.audios[0].base64, "base64").toString()).toBe("audio-falso");
  });

  it("sin permiso (la IA no devuelve historia) no se guarda nada", async () => {
    const d = deps(db);
    await procesarEntrante(d, { tipo: "audio", de: datos.adulto.telefono, id: "wamid.h2", mediaId: "m1", mime: "audio/ogg" });
    const [p] = await db.select().from(platicas);
    await cerrarPlatica(d, p.id);
    expect(await db.select().from(historias)).toHaveLength(0);
  });

  it("las notas de voz se borran a los 30 días", async () => {
    const r = reloj("2026-11-02T15:00:00Z");
    const d = deps(db, { ahora: r.ahora });
    await procesarEntrante(d, { tipo: "audio", de: datos.adulto.telefono, id: "wamid.h3", mediaId: "m1", mime: "audio/ogg" });
    expect((await db.select().from(mensajes)).find((m) => m.de === "adulto")?.audio).not.toBeNull();
    r.fijar(new Date(Date.now() + 31 * 86400000).toISOString());
    await tick(d);
    expect((await db.select().from(mensajes)).find((m) => m.de === "adulto")?.audio).toBeNull();
  });
});

describe("el hijo pregunta por WhatsApp", () => {
  it("'¿cómo va mi mamá?' responde con lo último y el enlace a su página", async () => {
    const d = deps(db);
    await db.update(medicinas).set({ ultimoSurtido: "2026-10-20", duraDias: 30 });
    await db.insert(citas).values({ adultoId: datos.adulto.id, fecha: "2026-11-05", hora: "09:00", conQuien: "Dentista" });
    const r = await procesarEntrante(d, { tipo: "texto", de: "13105551234", id: "wamid.e1", texto: "¿Cómo va mi mamá?" });
    expect(r).toBe("estado");
    const respuesta = d.wa.textosA("13105551234")[0];
    expect(respuesta).toContain("Losartán (le quedan 17 días)");
    expect(respuesta).toContain("Dentista");
    const [f] = await db.select().from(familias);
    expect(respuesta).toContain(`https://acompana.mx/mama/${f.tokenPagina}`);
  });

  it("el estado nunca muestra resúmenes que no se han aprobado", async () => {
    const texto = await estadoParaFamilia(db, datos.adulto, "2026-11-02");
    expect(texto).toContain("Todavía no hay un resumen enviado");
  });

  it("cada familia tiene su enlace privado, distinto e imposible de adivinar", async () => {
    const [otra] = await db.insert(familias).values({ nombreContacto: "Ana", telefono: "13105550000", email: "a@b.c" }).returning();
    const [f] = await db.select().from(familias).where(eq(familias.id, datos.familia.id));
    expect(f.tokenPagina).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(otra.tokenPagina).not.toBe(f.tokenPagina);
    expect(await db.select().from(contactos)).toHaveLength(2);
  });
});
