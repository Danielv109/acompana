"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adultos, alertas, bandeja, citas, contactos, familias, medicinas, personas, platicas, recados, resumenes } from "@/lib/db/schema";
import { cerrarPlatica, depsReales, procesarEntrante, saludar, type Deps } from "@/lib/acompana";
import { recordatoriosFamilia } from "@/lib/ficha";
import { ahoraEnZona, sumarDias } from "@/lib/tiempo";
import { env } from "@/lib/env";
import { exigirSesion } from "@/lib/sesion";

const RUTA = "/panel/probar";

async function preparar() {
  await exigirSesion();
  if (!env.modoPrueba) throw new Error("El modo prueba está apagado.");
  // En el simulador no hace falta esperar 7 segundos para juntar mensajes seguidos
  const d: Deps = { ...depsReales(), esperar: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 1200))) };
  return d;
}

function volver(adultoId: string, aviso?: string): never {
  revalidatePath(RUTA);
  redirect(`${RUTA}?adulto=${adultoId}${aviso ? `&aviso=${encodeURIComponent(aviso)}` : ""}`);
}

async function adultoDe(form: FormData) {
  const id = String(form.get("adulto") ?? "");
  const [a] = await getDb().select().from(adultos).where(eq(adultos.id, id));
  if (!a) redirect(RUTA);
  return a;
}

/** Una familia completa para probar: Doña Rosa, su hijo Juan, una vecina, una medicina por acabarse y una cita mañana. */
export async function crearFamiliaPrueba() {
  await preparar();
  const db = getDb();
  const sufijo = String(Date.now()).slice(-4);
  const [f] = await db.insert(familias).values({
    nombreContacto: "Juan", telefono: `52161800${sufijo}2`, email: "prueba@ejemplo.com", estado: "prueba",
  }).returning();
  const [a] = await db.insert(adultos).values({
    familiaId: f.id, nombre: "Rosa Martínez", comoLlamarle: "Doña Rosa", telefono: `52161800${sufijo}1`,
    canal: "texto", activo: true, consentimientoEn: new Date(), consentimientoMetodo: "Familia de prueba",
    sobreElla: "Vive sola en Durango. Le gusta su jardín, la novela de las 8 y cocinar mole. Su comadre Chela la visita seguido. Su nieta Sofía está en la universidad.",
  }).returning();
  await db.insert(contactos).values([
    { familiaId: f.id, nombre: "Juan", telefono: f.telefono, relacion: "hijo", recibeResumen: true, recibeAlertas: true, orden: 0 },
    { familiaId: f.id, nombre: "Lupita", telefono: `52161800${sufijo}3`, relacion: "vecina", recibeResumen: false, recibeAlertas: true, puedeAcudir: true, orden: 1 },
  ]);
  const { fecha } = ahoraEnZona(a.zonaHoraria);
  await db.insert(medicinas).values([
    { adultoId: a.id, nombre: "Losartán", dosis: "50 mg", horario: "en la mañana", ultimoSurtido: sumarDias(fecha, -26), duraDias: 30 },
    { adultoId: a.id, nombre: "Metformina", dosis: "850 mg", horario: "con la comida", ultimoSurtido: sumarDias(fecha, -5), duraDias: 30 },
  ]);
  await db.insert(citas).values({ adultoId: a.id, fecha: sumarDias(fecha, 1), hora: "10:00", conQuien: "Cardiólogo, Dr. Ramírez", lugar: "Clínica 1 del IMSS", creadaPor: "Juan" });
  volver(a.id, "Listo: creamos a Doña Rosa y a su hijo Juan. Empieza con «Mandar el saludo de hoy».");
}

/** Escribe un mensaje como si viniera de ese celular por WhatsApp. */
export async function escribirComo(form: FormData) {
  const d = await preparar();
  const a = await adultoDe(form);
  const telefono = String(form.get("telefono") ?? "");
  const texto = String(form.get("texto") ?? "").trim().slice(0, 1000);
  if (!texto || !telefono) volver(a.id);
  await getDb().insert(bandeja).values({ telefono, direccion: "entra", tipo: "texto", texto });
  let r: Awaited<ReturnType<typeof procesarEntrante>>;
  try {
    r = await procesarEntrante(d, { tipo: "texto", de: telefono, id: `prueba.${randomUUID()}`, texto });
  } catch (e) {
    console.error(e);
    volver(a.id, `Algo falló al procesar el mensaje: ${e instanceof Error ? e.message : e}`);
  }
  if (r === "ignorado") volver(a.id, "Ese mensaje se ignoró: el número no está registrado o ella todavía no tiene consentimiento.");
  if (telefono === a.telefono) {
    // Si con este mensaje se despidió, decimos qué pasó con el resumen
    const { fecha } = ahoraEnZona(a.zonaHoraria);
    const [p] = await getDb().select().from(platicas).where(and(eq(platicas.adultoId, a.id), eq(platicas.fecha, fecha)));
    if (p?.estado === "terminada") {
      const [res] = await getDb().select().from(resumenes).where(eq(resumenes.platicaId, p.id));
      if (res?.estado === "pendiente") volver(a.id, "Se despidió. Como hubo algo delicado, el resumen espera tu revisión en «Resúmenes por revisar» antes de llegarle al hijo.");
      if (res?.estado === "enviado") volver(a.id, "Se despidió. El resumen ya le llegó al hijo y está en la página de la familia.");
    }
  }
  volver(a.id);
}

export async function mandarSaludo(form: FormData) {
  const d = await preparar();
  const a = await adultoDe(form);
  const { fecha } = ahoraEnZona(a.zonaHoraria);
  const r = await saludar(d, a, fecha);
  volver(a.id, r
    ? `Saludo enviado.${r.recordatorios ? ` También salieron ${r.recordatorios} recordatorios para el hijo.` : ""} Ahora contesta como ella.`
    : "Hoy ya se le saludó. Usa «Empezar de cero» para repetir el día.");
}

export async function terminarPlatica(form: FormData) {
  const d = await preparar();
  const a = await adultoDe(form);
  const { fecha } = ahoraEnZona(a.zonaHoraria);
  const [p] = await getDb().select().from(platicas).where(and(eq(platicas.adultoId, a.id), eq(platicas.fecha, fecha)));
  if (!p) volver(a.id, "Todavía no hay plática hoy. Primero manda el saludo.");
  const r = await cerrarPlatica(d, p.id);
  volver(a.id, r?.estado === "enviado"
    ? "Plática terminada. El resumen ya salió (revisa el celular del hijo y la página)."
    : "Plática terminada. Como fue un día delicado, el resumen espera tu revisión en «Resúmenes por revisar».");
}

export async function mandarRecordatorios(form: FormData) {
  const d = await preparar();
  const a = await adultoDe(form);
  const { fecha } = ahoraEnZona(a.zonaHoraria);
  const n = await recordatoriosFamilia(d, a, fecha);
  volver(a.id, n ? `Salieron ${n} recordatorios para el hijo.` : "No había recordatorios pendientes (cada uno sale una sola vez; «Empezar de cero» los reinicia).");
}

/** Borra las pláticas y mensajes de esta familia para repetir la prueba. Conserva medicinas, citas y su gente. */
export async function empezarDeCero(form: FormData) {
  await preparar();
  const a = await adultoDe(form);
  const db = getDb();
  const cs = await db.select({ telefono: contactos.telefono }).from(contactos).where(eq(contactos.familiaId, a.familiaId));
  const telefonos = [a.telefono, ...cs.map((c) => c.telefono), ...(env.adminWhatsapp ? [env.adminWhatsapp] : [])];
  await db.delete(bandeja).where(inArray(bandeja.telefono, telefonos));
  await db.delete(alertas).where(eq(alertas.adultoId, a.id));
  await db.delete(recados).where(eq(recados.adultoId, a.id));
  await db.delete(platicas).where(eq(platicas.adultoId, a.id));
  await db.update(medicinas).set({ recordadoEn: null }).where(eq(medicinas.adultoId, a.id));
  await db.update(citas).set({ recordatorioEnviadoEn: null }).where(eq(citas.adultoId, a.id));
  await db.update(personas).set({ recordadoAnio: null }).where(eq(personas.adultoId, a.id));
  volver(a.id, "Listo, empezamos el día de nuevo.");
}
