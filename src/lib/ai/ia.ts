import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";
import type { DatosResumen } from "../db/schema";
import {
  herramientaClasificar, herramientaResponder, herramientaResumir,
  instruccionesClasificar, instruccionesPlatica, instruccionesResumen, instruccionIniciar, type Perfil,
} from "./instrucciones";
import type { Nivel } from "./senales";

export type Turno = { de: "adulto" | "acompana"; texto: string };

export type PersonaMencionada = { nombre: string; relacion: string; nota: string; cumpleanos?: string };

export type ResultadoResumen = {
  resumen: string;
  /** Versión corta para WhatsApp */
  aviso: string;
  importante: boolean;
  nivel: Nivel;
  datos: DatosResumen;
  memoria: string[];
  personas: PersonaMencionada[];
  loQueContoDelDoctor: string;
  /** "mensajes" son posiciones (desde 1) dentro del historial que se le pasó */
  historia: { titulo: string; texto: string; mensajes: number[] } | null;
};

export type ContextoResumen = { citasPorPreguntar: string[] };

/** Lo que la app necesita de la IA. En pruebas se reemplaza por una versión falsa. */
export interface IA {
  responder(perfil: Perfil, historial: Turno[]): Promise<{ mensaje: string; terminar: boolean }>;
  /** Escribirle primero, con un motivo (por ejemplo, preguntarle cómo le fue en su cita). */
  iniciar(perfil: Perfil, historial: Turno[], motivo: string): Promise<string>;
  clasificar(comoLlamarle: string, mensaje: string): Promise<{ nivel: Nivel; motivo: string }>;
  resumir(perfil: Perfil, historial: Turno[], contexto?: ContextoResumen): Promise<ResultadoResumen>;
}

function aMensajes(historial: Turno[]): Anthropic.MessageParam[] {
  // La API espera que el primer mensaje sea del "usuario" (el adulto mayor).
  // El saludo de la mañana lo mandamos nosotros, así que lo ponemos como contexto.
  const mensajes: Anthropic.MessageParam[] = [];
  for (const t of historial) {
    const role = t.de === "adulto" ? "user" : "assistant";
    const ultimo = mensajes.at(-1);
    if (ultimo && ultimo.role === role) {
      ultimo.content = `${ultimo.content as string}\n${t.texto}`;
    } else {
      mensajes.push({ role, content: t.texto });
    }
  }
  if (mensajes[0]?.role === "assistant") {
    mensajes.unshift({ role: "user", content: "(Contexto: Acompaña le mandó el saludo de la mañana.)" });
  }
  return mensajes;
}

function entradaDeHerramienta<T>(respuesta: Anthropic.Message, nombre: string): T {
  const bloque = respuesta.content.find((b) => b.type === "tool_use" && b.name === nombre);
  if (!bloque || bloque.type !== "tool_use") {
    throw new Error(`La IA no respondió con la herramienta "${nombre}".`);
  }
  return bloque.input as T;
}

export class IAClaude implements IA {
  private cliente: Anthropic;

  constructor(cliente?: Anthropic) {
    this.cliente = cliente ?? new Anthropic({ apiKey: env.anthropicKey });
  }

  async responder(perfil: Perfil, historial: Turno[]) {
    const r = await this.cliente.messages.create({
      model: env.modelo,
      max_tokens: 400,
      system: instruccionesPlatica(perfil),
      tools: [herramientaResponder],
      tool_choice: { type: "tool", name: "responder" },
      messages: aMensajes(historial),
    });
    const { mensaje, terminar } = entradaDeHerramienta<{ mensaje: string; terminar: boolean }>(r, "responder");
    return { mensaje: mensaje.trim(), terminar: Boolean(terminar) };
  }

  async iniciar(perfil: Perfil, historial: Turno[], motivo: string) {
    const mensajes = aMensajes(historial);
    const ultimo = mensajes.at(-1);
    const indicacion = instruccionIniciar(motivo);
    if (ultimo?.role === "user") ultimo.content = `${ultimo.content as string}\n\n${indicacion}`;
    else mensajes.push({ role: "user", content: indicacion });
    const r = await this.cliente.messages.create({
      model: env.modelo,
      max_tokens: 300,
      system: instruccionesPlatica(perfil),
      tools: [herramientaResponder],
      tool_choice: { type: "tool", name: "responder" },
      messages: mensajes,
    });
    return entradaDeHerramienta<{ mensaje: string }>(r, "responder").mensaje.trim();
  }

  async clasificar(comoLlamarle: string, mensaje: string) {
    const r = await this.cliente.messages.create({
      model: env.modeloRapido,
      max_tokens: 200,
      system: instruccionesClasificar(comoLlamarle),
      tools: [herramientaClasificar],
      tool_choice: { type: "tool", name: "clasificar" },
      messages: [{ role: "user", content: mensaje }],
    });
    return entradaDeHerramienta<{ nivel: Nivel; motivo: string }>(r, "clasificar");
  }

  async resumir(perfil: Perfil, historial: Turno[], contexto: ContextoResumen = { citasPorPreguntar: [] }) {
    const transcripcion = historial.length
      ? historial.map((t, i) => `[${i + 1}] ${t.de === "adulto" ? perfil.comoLlamarle : "Acompaña"}: ${t.texto}`).join("\n")
      : "(No contestó hoy.)";
    const r = await this.cliente.messages.create({
      model: env.modelo,
      max_tokens: 1800,
      system: instruccionesResumen({ comoLlamarle: perfil.comoLlamarle, nombreFamiliar: perfil.nombreFamiliar, fechaLarga: perfil.fechaLarga, citasPorPreguntar: contexto.citasPorPreguntar }),
      tools: [herramientaResumir],
      tool_choice: { type: "tool", name: "resumir" },
      messages: [{ role: "user", content: `Esta es la plática de hoy:\n\n${transcripcion}` }],
    });
    const x = entradaDeHerramienta<{
      resumen: string; aviso?: string; importante?: boolean; nivel: Nivel; medicinaTomada: DatosResumen["medicinaTomada"]; animo: DatosResumen["animo"];
      comio: DatosResumen["comio"]; temasDeSalud: string[]; cosasBonitas: string[]; pendientes: string[]; memoria: string[];
      personas?: PersonaMencionada[]; loQueContoDelDoctor?: string; historia?: { titulo: string; texto: string; mensajes: number[] };
    }>(r, "resumir");
    return {
      resumen: x.resumen.trim(),
      aviso: (x.aviso ?? "").trim(),
      importante: Boolean(x.importante) || x.nivel !== "verde",
      nivel: x.nivel,
      memoria: x.memoria ?? [],
      personas: (x.personas ?? []).filter((p) => p.nombre?.trim()),
      loQueContoDelDoctor: (x.loQueContoDelDoctor ?? "").trim(),
      historia: x.historia?.texto?.trim() ? { titulo: x.historia.titulo.trim(), texto: x.historia.texto.trim(), mensajes: x.historia.mensajes ?? [] } : null,
      datos: {
        medicinaTomada: x.medicinaTomada, animo: x.animo, comio: x.comio,
        temasDeSalud: x.temasDeSalud ?? [], cosasBonitas: x.cosasBonitas ?? [], pendientes: x.pendientes ?? [],
      },
    };
  }
}

let ia: IA | null = null;
export function getIA(): IA {
  if (!ia) ia = new IAClaude();
  return ia;
}
export function usarIA(nueva: IA) {
  ia = nueva;
}
