"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { citas, familias, medicinas, recados } from "@/lib/db/schema";
import { ahoraEnZona } from "@/lib/tiempo";
import { familiaPorToken } from "./datos";

function texto(form: FormData, campo: string, max = 200) {
  return String(form.get(campo) ?? "").trim().slice(0, max);
}

async function contexto(form: FormData) {
  const token = texto(form, "token", 80);
  const r = await familiaPorToken(token);
  if (!r) throw new Error("Enlace no válido.");
  return { ...r, ruta: `/mama/${token}` };
}

export async function agregarMedicina(form: FormData) {
  const { adulto, ruta } = await contexto(form);
  const nombre = texto(form, "nombre", 120);
  if (!nombre) return;
  const dura = Number(texto(form, "duraDias", 4));
  await getDb().insert(medicinas).values({
    adultoId: adulto.id, nombre, dosis: texto(form, "dosis", 60), horario: texto(form, "horario", 80),
    duraDias: Number.isInteger(dura) && dura > 0 && dura < 400 ? dura : null,
    ultimoSurtido: /^\d{4}-\d{2}-\d{2}$/.test(texto(form, "ultimoSurtido", 10)) ? texto(form, "ultimoSurtido", 10) : null,
  });
  revalidatePath(ruta);
}

export async function guardarSurtido(form: FormData) {
  const { adulto, ruta } = await contexto(form);
  const dura = Number(texto(form, "duraDias", 4));
  const fecha = texto(form, "ultimoSurtido", 10);
  await getDb().update(medicinas).set({
    duraDias: Number.isInteger(dura) && dura > 0 && dura < 400 ? dura : null,
    ultimoSurtido: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
  }).where(and(eq(medicinas.id, texto(form, "id", 40)), eq(medicinas.adultoId, adulto.id)));
  revalidatePath(ruta);
}

export async function yaLaSurti(form: FormData) {
  const { adulto, ruta } = await contexto(form);
  const { fecha } = ahoraEnZona(adulto.zonaHoraria);
  await getDb().update(medicinas).set({ ultimoSurtido: fecha })
    .where(and(eq(medicinas.id, texto(form, "id", 40)), eq(medicinas.adultoId, adulto.id)));
  revalidatePath(ruta);
}

export async function quitarMedicina(form: FormData) {
  const { adulto, ruta } = await contexto(form);
  await getDb().delete(medicinas).where(and(eq(medicinas.id, texto(form, "id", 40)), eq(medicinas.adultoId, adulto.id)));
  revalidatePath(ruta);
}

export async function agregarCita(form: FormData) {
  const { adulto, familia, ruta } = await contexto(form);
  const fecha = texto(form, "fecha", 10);
  const conQuien = texto(form, "conQuien", 120);
  const hora = texto(form, "hora", 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !conQuien) return;
  await getDb().insert(citas).values({
    adultoId: adulto.id, fecha, conQuien, lugar: texto(form, "lugar", 160),
    hora: /^([01]\d|2[0-3]):[0-5]\d$/.test(hora) ? hora : "", creadaPor: familia.nombreContacto,
  });
  revalidatePath(ruta);
}

export async function quitarCita(form: FormData) {
  const { adulto, ruta } = await contexto(form);
  await getDb().delete(citas).where(and(eq(citas.id, texto(form, "id", 40)), eq(citas.adultoId, adulto.id)));
  revalidatePath(ruta);
}

export async function mandarRecado(form: FormData) {
  const { adulto, familia, ruta } = await contexto(form);
  const contenido = texto(form, "recado", 500);
  if (contenido.length < 3) return;
  await getDb().insert(recados).values({ adultoId: adulto.id, deQuien: texto(form, "deQuien", 60) || familia.nombreContacto, texto: contenido });
  revalidatePath(ruta);
}

export async function cambiarAvisos(form: FormData) {
  const { familia, ruta } = await contexto(form);
  const avisos = texto(form, "avisos", 12);
  if (avisos !== "diario" && avisos !== "importante") return;
  await getDb().update(familias).set({ avisos }).where(eq(familias.id, familia.id));
  revalidatePath(ruta);
}
