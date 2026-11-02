"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adultos, alertas, contactos, fichasEmergencia, medicinas, resumenes } from "@/lib/db/schema";
import { esTelefonoValido, normalizarTelefono } from "@/lib/telefono";
import { cerrarSesion, contrasenaCorrecta, exigirSesion, iniciarSesion } from "@/lib/sesion";
import { depsReales, enviarResumen } from "@/lib/acompana";

export type EstadoAccion = { error?: string; ok?: string; nombre?: string };

export async function entrar(_: EstadoAccion, form: FormData): Promise<EstadoAccion> {
  const nombre = String(form.get("nombre") ?? "").trim();
  const contrasena = String(form.get("contrasena") ?? "");
  if (!nombre) return { error: "Escribe tu nombre: aparece en cada resumen que apruebes." };
  if (!contrasenaCorrecta(contrasena)) return { error: "La contraseña no coincide.", nombre };
  await iniciarSesion(nombre);
  redirect("/panel");
}

export async function salir() {
  await cerrarSesion();
  redirect("/panel/entrar");
}

export async function aprobarResumen(_: EstadoAccion, form: FormData): Promise<EstadoAccion> {
  const sesion = await exigirSesion();
  const id = String(form.get("id"));
  const texto = String(form.get("texto") ?? "").trim();
  if (texto.length < 20) return { error: "El resumen es demasiado corto. Agrega cómo está y algo concreto de la plática." };
  try {
    const r = await enviarResumen(depsReales(), id, texto, sesion.nombre);
    revalidatePath("/panel");
    return { ok: r.yaEnviado ? "Este resumen ya se había enviado." : `Enviado a ${r.enviados} ${r.enviados === 1 ? "familiar" : "familiares"}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo enviar." };
  }
}

export async function descartarResumen(form: FormData) {
  const sesion = await exigirSesion();
  await getDb().update(resumenes).set({ estado: "descartado", revisadoPor: sesion.nombre }).where(eq(resumenes.id, String(form.get("id"))));
  revalidatePath("/panel");
}

export async function atenderAlerta(form: FormData) {
  const sesion = await exigirSesion();
  const nota = String(form.get("nota") ?? "").trim();
  await getDb().update(alertas).set({
    estado: "atendida", atendidaEn: new Date(), notaAtencion: `${sesion.nombre}: ${nota || "Atendida."}`,
  }).where(eq(alertas.id, String(form.get("id"))));
  revalidatePath("/panel/alertas");
}

export async function registrarConsentimiento(form: FormData) {
  const sesion = await exigirSesion();
  const id = String(form.get("id"));
  const metodo = String(form.get("metodo") ?? "");
  if (!metodo) return;
  await getDb().update(adultos).set({
    consentimientoEn: new Date(), consentimientoMetodo: `${metodo} (registró ${sesion.nombre})`, activo: true,
  }).where(eq(adultos.id, id));
  revalidatePath(`/panel/familias`);
}

export async function cambiarActivo(form: FormData) {
  await exigirSesion();
  const id = String(form.get("id"));
  const activo = form.get("activo") === "1";
  const [a] = await getDb().select().from(adultos).where(eq(adultos.id, id));
  if (activo && !a?.consentimientoEn) return; // sin consentimiento no se activa
  await getDb().update(adultos).set({ activo }).where(eq(adultos.id, id));
  revalidatePath(`/panel/familias`);
}

// ─── Editar una familia ─────────────────────────────────────

function texto(form: FormData, campo: string, max = 1500): string {
  return String(form.get(campo) ?? "").trim().slice(0, max);
}

function rutaFamilia(form: FormData) {
  return `/panel/familias/${String(form.get("familiaId"))}`;
}

export async function guardarAjustes(form: FormData) {
  await exigirSesion();
  const hora = texto(form, "horaSaludo", 5);
  const canal = texto(form, "canal", 10);
  const comoLlamarle = texto(form, "comoLlamarle", 80);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora) || !["voz", "texto"].includes(canal) || comoLlamarle.length < 2) return;
  await getDb().update(adultos).set({
    horaSaludo: hora, canal: canal as "voz" | "texto", comoLlamarle, sobreElla: texto(form, "sobreElla"),
  }).where(eq(adultos.id, String(form.get("id"))));
  revalidatePath(rutaFamilia(form));
}

export async function guardarFicha(form: FormData) {
  await exigirSesion();
  const adultoId = String(form.get("adultoId"));
  const valores = {
    direccion: texto(form, "direccion", 300), referencias: texto(form, "referencias", 300),
    enfermedades: texto(form, "enfermedades", 300), alergias: texto(form, "alergias", 300),
    tipoSangre: texto(form, "tipoSangre", 10), seguro: texto(form, "seguro", 120),
    hospitalCercano: texto(form, "hospitalCercano", 200), quienTieneLlave: texto(form, "quienTieneLlave", 200),
  };
  await getDb().insert(fichasEmergencia).values({ adultoId, ...valores })
    .onConflictDoUpdate({ target: fichasEmergencia.adultoId, set: valores });
  revalidatePath(rutaFamilia(form));
}

export async function agregarMedicina(form: FormData) {
  await exigirSesion();
  const nombre = texto(form, "nombre", 120);
  if (!nombre) return;
  await getDb().insert(medicinas).values({ adultoId: String(form.get("adultoId")), nombre, dosis: texto(form, "dosis", 60), horario: texto(form, "horario", 80) });
  revalidatePath(rutaFamilia(form));
}

export async function quitarMedicina(form: FormData) {
  await exigirSesion();
  await getDb().delete(medicinas).where(eq(medicinas.id, String(form.get("id"))));
  revalidatePath(rutaFamilia(form));
}

export async function agregarContacto(form: FormData) {
  await exigirSesion();
  const tel = texto(form, "telefono", 25);
  const nombre = texto(form, "nombre", 80);
  if (!nombre || !esTelefonoValido(tel)) return;
  const familiaId = String(form.get("familiaId"));
  const existentes = await getDb().select().from(contactos).where(eq(contactos.familiaId, familiaId));
  await getDb().insert(contactos).values({
    familiaId, nombre, telefono: normalizarTelefono(tel), relacion: texto(form, "relacion", 40) || "familiar",
    recibeResumen: form.get("recibeResumen") === "si", recibeAlertas: form.get("recibeAlertas") === "si",
    puedeAcudir: form.get("puedeAcudir") === "si", orden: existentes.length,
  });
  revalidatePath(rutaFamilia(form));
}

export async function quitarContacto(form: FormData) {
  await exigirSesion();
  await getDb().delete(contactos).where(eq(contactos.id, String(form.get("id"))));
  revalidatePath(rutaFamilia(form));
}
