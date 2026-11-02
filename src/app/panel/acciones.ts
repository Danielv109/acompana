"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adultos, alertas, resumenes } from "@/lib/db/schema";
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
