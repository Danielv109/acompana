import {
  pgTable, uuid, text, timestamp, boolean, integer, date, jsonb, uniqueIndex, index, customType,
} from "drizzle-orm/pg-core";
import { randomBytes } from "node:crypto";

/** Audio guardado en la base de datos (notas de voz cortas, decenas de KB). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/** Enlace privado de la página de la familia: imposible de adivinar. */
export function nuevoToken(): string {
  return randomBytes(18).toString("base64url");
}

/** La familia que contrata (normalmente el hijo o la hija). */
export const familias = pgTable("familias", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombreContacto: text("nombre_contacto").notNull(),
  telefono: text("telefono").notNull(), // WhatsApp, solo dígitos con lada (ej. 5216181234567)
  email: text("email").notNull(),
  plan: text("plan", { enum: ["basico", "completo"] }).notNull().default("basico"),
  moneda: text("moneda", { enum: ["mxn", "usd"] }).notNull().default("mxn"),
  estado: text("estado", { enum: ["prueba", "activa", "pausada", "cancelada"] }).notNull().default("prueba"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  pruebaTerminaEn: timestamp("prueba_termina_en", { withTimezone: true }),
  /** Enlace privado de "la página de mamá": /mama/<token> */
  tokenPagina: text("token_pagina").$defaultFn(nuevoToken),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("familias_token_idx").on(t.tokenPagina)]);

/** Personas que reciben resúmenes o alertas, o que pueden acudir en persona. */
export const contactos = pgTable("contactos", {
  id: uuid("id").primaryKey().defaultRandom(),
  familiaId: uuid("familia_id").notNull().references(() => familias.id, { onDelete: "cascade" }),
  nombre: text("nombre").notNull(),
  telefono: text("telefono").notNull(),
  relacion: text("relacion").notNull(), // hijo, hija, vecina, sobrino...
  recibeResumen: boolean("recibe_resumen").notNull().default(true),
  recibeAlertas: boolean("recibe_alertas").notNull().default(true),
  puedeAcudir: boolean("puede_acudir").notNull().default(false), // vive cerca y puede ir a la casa
  orden: integer("orden").notNull().default(0),
}, (t) => [index("contactos_familia_idx").on(t.familiaId)]);

/** El adulto mayor que recibe el acompañamiento. */
export const adultos = pgTable("adultos", {
  id: uuid("id").primaryKey().defaultRandom(),
  familiaId: uuid("familia_id").notNull().references(() => familias.id, { onDelete: "cascade" }),
  nombre: text("nombre").notNull(),
  comoLlamarle: text("como_llamarle").notNull(), // "Doña Rosa", "Don Beto"
  telefono: text("telefono").notNull(),
  zonaHoraria: text("zona_horaria").notNull().default("America/Mexico_City"),
  horaSaludo: text("hora_saludo").notNull().default("09:00"), // HH:MM hora local
  canal: text("canal", { enum: ["voz", "texto"] }).notNull().default("voz"),
  sobreElla: text("sobre_ella").notNull().default(""), // gustos, temas, familia, cosas a evitar
  activo: boolean("activo").notNull().default(true),
  consentimientoEn: timestamp("consentimiento_en", { withTimezone: true }),
  consentimientoMetodo: text("consentimiento_metodo"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("adultos_telefono_idx").on(t.telefono)]);

/** Lo que se le dicta al 911 o a los paramédicos. */
export const fichasEmergencia = pgTable("fichas_emergencia", {
  adultoId: uuid("adulto_id").primaryKey().references(() => adultos.id, { onDelete: "cascade" }),
  direccion: text("direccion").notNull().default(""),
  referencias: text("referencias").notNull().default(""),
  enfermedades: text("enfermedades").notNull().default(""),
  alergias: text("alergias").notNull().default(""),
  tipoSangre: text("tipo_sangre").notNull().default(""),
  seguro: text("seguro").notNull().default(""),
  hospitalCercano: text("hospital_cercano").notNull().default(""),
  quienTieneLlave: text("quien_tiene_llave").notNull().default(""),
});

export const medicinas = pgTable("medicinas", {
  id: uuid("id").primaryKey().defaultRandom(),
  adultoId: uuid("adulto_id").notNull().references(() => adultos.id, { onDelete: "cascade" }),
  nombre: text("nombre").notNull(),
  dosis: text("dosis").notNull().default(""),
  horario: text("horario").notNull().default(""), // texto libre: "en la mañana", "8 y 20 h"
  // Lo llena la familia: con esto le avisamos al hijo antes de que se acabe (a ella nunca)
  ultimoSurtido: date("ultimo_surtido"),
  duraDias: integer("dura_dias"),
  recordadoEn: timestamp("recordado_en", { withTimezone: true }),
});

/** Una plática diaria: el saludo de la mañana y todo lo que se habló ese día. */
export const platicas = pgTable("platicas", {
  id: uuid("id").primaryKey().defaultRandom(),
  adultoId: uuid("adulto_id").notNull().references(() => adultos.id, { onDelete: "cascade" }),
  fecha: date("fecha").notNull(), // fecha local del adulto
  estado: text("estado", { enum: ["enviada", "en_curso", "terminada", "sin_respuesta"] }).notNull().default("enviada"),
  intentos: integer("intentos").notNull().default(1),
  enviadaEn: timestamp("enviada_en", { withTimezone: true }).notNull().defaultNow(),
  ultimaActividadEn: timestamp("ultima_actividad_en", { withTimezone: true }).notNull().defaultNow(),
  terminadaEn: timestamp("terminada_en", { withTimezone: true }),
}, (t) => [uniqueIndex("platicas_adulto_fecha_idx").on(t.adultoId, t.fecha)]);

export const mensajes = pgTable("mensajes", {
  id: uuid("id").primaryKey().defaultRandom(),
  platicaId: uuid("platica_id").notNull().references(() => platicas.id, { onDelete: "cascade" }),
  de: text("de", { enum: ["adulto", "acompana"] }).notNull(),
  tipo: text("tipo", { enum: ["texto", "audio"] }).notNull(),
  texto: text("texto").notNull(),
  waMessageId: text("wa_message_id"),
  // Su nota de voz original. Se borra a los 30 días, salvo que forme parte de una historia.
  audio: bytea("audio"),
  audioMime: text("audio_mime"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("mensajes_wa_idx").on(t.waMessageId),
  index("mensajes_platica_idx").on(t.platicaId),
]);

export type DatosResumen = {
  medicinaTomada: "si" | "no" | "no_se_sabe";
  animo: "bien" | "regular" | "decaido" | "no_se_sabe";
  comio: "si" | "no" | "no_se_sabe";
  temasDeSalud: string[];
  cosasBonitas: string[];
  pendientes: string[];
};

/** Resumen para la familia. Nada sale sin que una persona lo apruebe. */
export const resumenes = pgTable("resumenes", {
  id: uuid("id").primaryKey().defaultRandom(),
  platicaId: uuid("platica_id").notNull().references(() => platicas.id, { onDelete: "cascade" }),
  nivel: text("nivel", { enum: ["verde", "amarillo", "rojo"] }).notNull(),
  textoBorrador: text("texto_borrador").notNull(),
  textoFinal: text("texto_final"),
  datos: jsonb("datos").$type<DatosResumen>().notNull(),
  memoria: text("memoria").notNull().default(""), // lo que conviene recordar mañana
  estado: text("estado", { enum: ["pendiente", "enviado", "descartado"] }).notNull().default("pendiente"),
  revisadoPor: text("revisado_por"),
  enviadoEn: timestamp("enviado_en", { withTimezone: true }),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("resumenes_platica_idx").on(t.platicaId)]);

export const alertas = pgTable("alertas", {
  id: uuid("id").primaryKey().defaultRandom(),
  adultoId: uuid("adulto_id").notNull().references(() => adultos.id, { onDelete: "cascade" }),
  platicaId: uuid("platica_id").references(() => platicas.id, { onDelete: "set null" }),
  nivel: text("nivel", { enum: ["amarillo", "rojo"] }).notNull(),
  motivo: text("motivo").notNull(),
  frase: text("frase").notNull().default(""), // lo que dijo, textual
  estado: text("estado", { enum: ["abierta", "atendida"] }).notNull().default("abierta"),
  notaAtencion: text("nota_atencion"),
  creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
  atendidaEn: timestamp("atendida_en", { withTimezone: true }),
}, (t) => [index("alertas_estado_idx").on(t.estado)]);

/** Recados que la familia le manda (por WhatsApp, empezando con "Recado"). Se los decimos en la siguiente plática. */
export const recados = pgTable("recados", {
  id: uuid("id").primaryKey().defaultRandom(),
  adultoId: uuid("adulto_id").notNull().references(() => adultos.id, { onDelete: "cascade" }),
  contactoId: uuid("contacto_id").references(() => contactos.id, { onDelete: "set null" }),
  deQuien: text("de_quien").notNull(), // "Juan (hijo)"
  texto: text("texto").notNull(),
  platicaId: uuid("platica_id").references(() => platicas.id, { onDelete: "set null" }),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  entregadoEn: timestamp("entregado_en", { withTimezone: true }),
}, (t) => [index("recados_adulto_idx").on(t.adultoId)]);

/** Citas médicas que registra la familia. Después de la cita, la IA le pregunta cómo le fue. */
export const citas = pgTable("citas", {
  id: uuid("id").primaryKey().defaultRandom(),
  adultoId: uuid("adulto_id").notNull().references(() => adultos.id, { onDelete: "cascade" }),
  fecha: date("fecha").notNull(),
  hora: text("hora").notNull().default(""), // HH:MM o vacío
  conQuien: text("con_quien").notNull(), // "Cardiólogo, Dr. Ramírez"
  lugar: text("lugar").notNull().default(""),
  loQueConto: text("lo_que_conto"), // lo que ella contó del doctor
  recordatorioEnviadoEn: timestamp("recordatorio_enviado_en", { withTimezone: true }),
  seguimiento: text("seguimiento", { enum: ["pendiente", "enviado", "hecho"] }).notNull().default("pendiente"),
  creadaPor: text("creada_por").notNull().default(""),
  creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("citas_adulto_fecha_idx").on(t.adultoId, t.fecha)]);

/** Su gente: comadres, vecinas, nietos. La IA se acuerda de ellos y del último chisme. */
export const personas = pgTable("personas", {
  id: uuid("id").primaryKey().defaultRandom(),
  adultoId: uuid("adulto_id").notNull().references(() => adultos.id, { onDelete: "cascade" }),
  nombre: text("nombre").notNull(),
  relacion: text("relacion").notNull().default(""),
  notas: text("notas").notNull().default(""), // lo último que contó de esta persona
  cumpleanos: text("cumpleanos"), // MM-DD
  recordadoAnio: integer("recordado_anio"),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("personas_adulto_nombre_idx").on(t.adultoId, t.nombre)]);

/** Historias de su vida, con su voz. Para la familia, para siempre. */
export const historias = pgTable("historias", {
  id: uuid("id").primaryKey().defaultRandom(),
  adultoId: uuid("adulto_id").notNull().references(() => adultos.id, { onDelete: "cascade" }),
  platicaId: uuid("platica_id").references(() => platicas.id, { onDelete: "set null" }),
  titulo: text("titulo").notNull(),
  texto: text("texto").notNull(),
  audios: jsonb("audios").$type<Array<{ mime: string; base64: string }>>().notNull().default([]),
  creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("historias_adulto_idx").on(t.adultoId)]);
