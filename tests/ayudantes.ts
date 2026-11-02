import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import * as schema from "../src/lib/db/schema";
import type { Db } from "../src/lib/db/client";
import type { Deps } from "../src/lib/acompana";
import type { IA, Turno } from "../src/lib/ai/ia";
import type { Voz } from "../src/lib/voz/voz";
import type { Mensajero } from "../src/lib/whatsapp/mensajero";
import type { Perfil } from "../src/lib/ai/instrucciones";
import type { Nivel } from "../src/lib/ai/senales";

export async function dbDePrueba(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../drizzle") });
  return db as unknown as Db;
}

export class WhatsAppFalso implements Mensajero {
  enviados: Array<{ tipo: "texto" | "audio" | "plantilla"; para: string; contenido: string; parametros?: string[] }> = [];
  private n = 0;
  async enviarTexto(para: string, texto: string) { this.enviados.push({ tipo: "texto", para, contenido: texto }); return `wamid.salida.${++this.n}`; }
  async enviarAudio(para: string, audio: Buffer) { this.enviados.push({ tipo: "audio", para, contenido: audio.toString() }); return `wamid.salida.${++this.n}`; }
  async enviarPlantilla(para: string, plantilla: string, parametros: string[]) { this.enviados.push({ tipo: "plantilla", para, contenido: plantilla, parametros }); return `wamid.salida.${++this.n}`; }
  async descargarMedia(_id: string) { return { datos: Buffer.from("audio-falso"), mime: "audio/ogg" }; }
  async marcarLeido() {}
  plantillas(nombre: string) { return this.enviados.filter((e) => e.tipo === "plantilla" && e.contenido === nombre); }
}

export class VozFalsa implements Voz {
  transcripcion = "Amanecí bien, gracias";
  async transcribir() { return this.transcripcion; }
  async sintetizar(texto: string) { return Buffer.from(`voz:${texto}`); }
}

export class IAFalsa implements IA {
  clasificacion: { nivel: Nivel; motivo: string } = { nivel: "verde", motivo: "" };
  respuesta = { mensaje: "Qué gusto escucharla. ¿Ya se tomó su pastilla?", terminar: false };
  fallarClasificacion = false;
  ultimoPerfil: Perfil | null = null;
  ultimoHistorial: Turno[] = [];
  async responder(perfil: Perfil, historial: Turno[]) { this.ultimoPerfil = perfil; this.ultimoHistorial = historial; return this.respuesta; }
  async clasificar() { if (this.fallarClasificacion) throw new Error("sin conexión"); return this.clasificacion; }
  async resumir(perfil: Perfil, historial: Turno[]) {
    return {
      resumen: `Resumen de ${perfil.comoLlamarle}: ${historial.length} mensajes.\nTodo tranquilo.`,
      nivel: "verde" as Nivel,
      memoria: ["Mañana va al mercado"],
      datos: { medicinaTomada: "si" as const, animo: "bien" as const, comio: "si" as const, temasDeSalud: [], cosasBonitas: [], pendientes: [] },
    };
  }
}

export function reloj(iso: string) {
  let actual = new Date(iso);
  return {
    ahora: () => actual,
    avanzarMinutos(m: number) { actual = new Date(actual.getTime() + m * 60000); },
    fijar(nuevo: string) { actual = new Date(nuevo); },
  };
}

export async function sembrar(db: Db) {
  const [familia] = await db.insert(schema.familias).values({ nombreContacto: "Juan Pérez", telefono: "13105551234", email: "juan@ejemplo.com", estado: "activa" }).returning();
  await db.insert(schema.contactos).values([
    { familiaId: familia.id, nombre: "Juan", telefono: "13105551234", relacion: "hijo", recibeResumen: true, recibeAlertas: true, orden: 0 },
    { familiaId: familia.id, nombre: "Lupita", telefono: "526181112233", relacion: "vecina", recibeResumen: false, recibeAlertas: true, puedeAcudir: true, orden: 1 },
  ]);
  const [adulto] = await db.insert(schema.adultos).values({
    familiaId: familia.id, nombre: "Rosa Martínez", comoLlamarle: "Doña Rosa", telefono: "526189998877",
    zonaHoraria: "America/Mexico_City", horaSaludo: "09:00", canal: "voz", sobreElla: "Le gusta su jardín y su novela de las 8.",
  }).returning();
  await db.insert(schema.medicinas).values({ adultoId: adulto.id, nombre: "Losartán", dosis: "50 mg", horario: "en la mañana" });
  return { familia, adulto };
}

export function deps(db: Db, extras: Partial<Deps> = {}): Deps & { wa: WhatsAppFalso; ia: IAFalsa; voz: VozFalsa } {
  return {
    db,
    ia: new IAFalsa(),
    voz: new VozFalsa(),
    wa: new WhatsAppFalso(),
    ahora: () => new Date("2026-11-02T15:00:00Z"),
    ...extras,
  } as Deps & { wa: WhatsAppFalso; ia: IAFalsa; voz: VozFalsa };
}
