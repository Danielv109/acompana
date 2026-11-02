"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { adultos, contactos, familias, fichasEmergencia, medicinas } from "@/lib/db/schema";
import { crearPago, stripeConfigurado, DIAS_DE_PRUEBA } from "@/lib/cobros";
import { getMensajero } from "@/lib/whatsapp/mensajero";
import { env } from "@/lib/env";
import { normalizarTelefono } from "@/lib/telefono";
import { esquemaRegistro, medicinasDe } from "./registro";

export type EstadoRegistro = { errores?: Record<string, string>; general?: string; valores?: Record<string, string> };

export async function registrar(_: EstadoRegistro, form: FormData): Promise<EstadoRegistro> {
  const valores = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  if (valores.sitioWeb) redirect("/gracias"); // bot: fingimos éxito y no guardamos nada
  delete valores.sitioWeb;
  const r = esquemaRegistro.safeParse(valores);
  if (!r.success) {
    const errores: Record<string, string> = {};
    for (const i of r.error.issues) {
      const campo = String(i.path[0] ?? "general");
      errores[campo] ??= i.message;
    }
    return { errores, valores, general: "Revisa los campos marcados en rojo." };
  }
  const d = r.data;

  let familia: typeof familias.$inferSelect;
  try {
    familia = await getDb().transaction(async (tx) => {
      const [f] = await tx.insert(familias).values({
        nombreContacto: d.tuNombre, telefono: d.tuTelefono, email: d.tuCorreo, plan: "basico", moneda: d.moneda, estado: "prueba",
        pruebaTerminaEn: new Date(Date.now() + DIAS_DE_PRUEBA * 86400000),
      }).returning();
      const filasContactos = [
        { familiaId: f.id, nombre: d.tuNombre, telefono: d.tuTelefono, relacion: d.tuRelacion, recibeResumen: true, recibeAlertas: true, puedeAcudir: false, orden: 0 },
        { familiaId: f.id, nombre: d.cercanoNombre, telefono: d.cercanoTelefono, relacion: d.cercanoRelacion, recibeResumen: false, recibeAlertas: true, puedeAcudir: true, orden: 1 },
      ];
      if (d.otroNombre && d.otroTelefono) {
        filasContactos.push({ familiaId: f.id, nombre: d.otroNombre, telefono: normalizarTelefono(d.otroTelefono), relacion: "familiar", recibeResumen: true, recibeAlertas: true, puedeAcudir: false, orden: 2 });
      }
      await tx.insert(contactos).values(filasContactos);
      const [a] = await tx.insert(adultos).values({
        familiaId: f.id, nombre: d.suNombre, comoLlamarle: d.comoLlamarle, telefono: d.suTelefono,
        horaSaludo: d.horaSaludo, canal: d.canal, sobreElla: d.sobreElla,
        activo: false, // se activa al registrar su consentimiento en la videollamada
      }).returning();
      await tx.insert(fichasEmergencia).values({
        adultoId: a.id, direccion: d.direccion, referencias: d.referencias, enfermedades: d.enfermedades, alergias: d.alergias,
        tipoSangre: d.tipoSangre, seguro: d.seguro, hospitalCercano: d.hospitalCercano,
        quienTieneLlave: d.cercanoTieneLlave === "si" ? `${d.cercanoNombre} (${d.cercanoRelacion})` : "",
      });
      const meds = medicinasDe(d);
      if (meds.length) await tx.insert(medicinas).values(meds.map((m) => ({ ...m, adultoId: a.id })));
      return f;
    });
  } catch (e) {
    const mensaje = String((e as { cause?: unknown })?.cause ?? e);
    if (mensaje.includes("adultos_telefono_idx")) {
      return { valores, errores: { suTelefono: "Este WhatsApp ya está registrado. Si es un error, escríbenos." }, general: "Revisa los campos marcados en rojo." };
    }
    console.error("Error al registrar familia", e);
    return { valores, general: "No pudimos guardar el registro. Intenta de nuevo en un momento o escríbenos por WhatsApp." };
  }

  // Bienvenida a la familia con el enlace a la página de su mamá
  if (familia.tokenPagina) {
    getMensajero()
      .enviarPlantilla(d.tuTelefono, env.plantillaBienvenida, [d.tuNombre, d.comoLlamarle, familia.tokenPagina])
      .catch((e) => console.error("No se pudo mandar la bienvenida", e));
  }

  // Te avisa que hay una familia nueva para agendar la videollamada
  if (env.adminWhatsapp) {
    getMensajero()
      .enviarPlantilla(env.adminWhatsapp, env.plantillaAvisoInterno, [`Nueva familia: ${d.tuNombre} (${d.tuRelacion} de ${d.comoLlamarle}). WhatsApp ${d.tuTelefono}. Agenda la videollamada de bienvenida.`])
      .catch((e) => console.error("No se pudo avisar de la nueva familia", e));
  }

  if (stripeConfigurado()) {
    let url: string;
    try {
      url = await crearPago(familia);
    } catch (e) {
      console.error("No se pudo crear la página de pago", e);
      redirect("/gracias");
    }
    redirect(url);
  }
  redirect("/gracias");
}
