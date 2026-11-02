import { z } from "zod";
import { esTelefonoValido, normalizarTelefono } from "@/lib/telefono";

const telefono = (mensaje: string) =>
  z.string().trim().refine(esTelefonoValido, mensaje).transform((t) => normalizarTelefono(t));
const texto = (max = 500) => z.string().trim().max(max).default("");

export const esquemaRegistro = z.object({
  // Tú
  tuNombre: z.string().trim().min(2, "Escribe tu nombre."),
  tuRelacion: z.string().trim().min(2, "Dinos qué eres de ella (hijo, hija, nieta...)."),
  tuTelefono: telefono("Tu WhatsApp no parece válido. Escribe 10 dígitos si es de México, o con +1 si es de EE.UU."),
  tuCorreo: z.string().trim().email("Revisa tu correo."),
  moneda: z.enum(["mxn", "usd"]),
  // Ella
  suNombre: z.string().trim().min(2, "Escribe su nombre completo."),
  comoLlamarle: z.string().trim().min(2, "¿Cómo le gusta que le digan? Por ejemplo: Doña Rosa."),
  suTelefono: telefono("El WhatsApp de ella no parece válido. Escribe sus 10 dígitos."),
  horaSaludo: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Elige una hora para el saludo."),
  canal: z.enum(["voz", "texto"]),
  sobreElla: texto(1500),
  // Medicinas (hasta 3)
  medicina1: texto(120), medicina2: texto(120), medicina3: texto(120),
  // Ficha de emergencia
  direccion: z.string().trim().min(8, "Escribe su dirección completa: es lo que se le dicta al 911."),
  referencias: texto(), enfermedades: texto(), alergias: texto(), tipoSangre: texto(10), seguro: texto(120), hospitalCercano: texto(200),
  // Alguien cerca
  cercanoNombre: z.string().trim().min(2, "Necesitamos a alguien que viva cerca y pueda ir a verla."),
  cercanoRelacion: z.string().trim().min(2, "¿Qué es de ella esta persona?"),
  cercanoTelefono: telefono("El teléfono de la persona cercana no parece válido."),
  cercanoTieneLlave: z.enum(["si", "no"]).default("no"),
  // Otro familiar que recibe resúmenes (opcional)
  otroNombre: texto(80), otroTelefono: texto(20),
  // Consentimientos
  aceptaPrivacidad: z.literal("si", { message: "Necesitamos que aceptes el aviso de privacidad y los términos." }),
  entiendeEmergencias: z.literal("si", { message: "Confirma que entiendes que no somos un servicio de emergencias." }),
  ellaSabe: z.literal("si", { message: "Ella debe saber y estar de acuerdo. Lo confirmamos en la videollamada." }),
}).superRefine((d, ctx) => {
  if (d.otroTelefono && !esTelefonoValido(d.otroTelefono)) {
    ctx.addIssue({ code: "custom", path: ["otroTelefono"], message: "El WhatsApp del otro familiar no parece válido." });
  }
  if (d.suTelefono === d.tuTelefono) {
    ctx.addIssue({ code: "custom", path: ["suTelefono"], message: "El WhatsApp de ella debe ser distinto al tuyo." });
  }
});

export type DatosRegistro = z.infer<typeof esquemaRegistro>;

/** "Losartán 50 mg en la mañana" → { nombre: "Losartán 50 mg en la mañana" } (se guarda tal cual la escribió la familia) */
export function medicinasDe(d: DatosRegistro) {
  return [d.medicina1, d.medicina2, d.medicina3].filter(Boolean).map((m) => ({ nombre: m, dosis: "", horario: "" }));
}
