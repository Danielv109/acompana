import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";
import type { DatosResumen } from "../db/schema";
import {
  herramientaClasificar, herramientaResponder, herramientaResumir,
  instruccionesClasificar, instruccionesPlatica, instruccionesResumen, type Perfil,
} from "./instrucciones";
import type { Nivel } from "./senales";

export type Turno = { de: "adulto" | "acompana"; texto: string };

export type ResultadoResumen = {
  resumen: string;
  nivel: Nivel;
  datos: DatosResumen;
  memoria: string[];
};

/** Lo que la app necesita de la IA. En pruebas se reemplaza por una versión falsa. */
export interface IA {
  responder(perfil: Perfil, historial: Turno[]): Promise<{ mensaje: string; terminar: boolean }>;
  clasificar(comoLlamarle: string, mensaje: string): Promise<{ nivel: Nivel; motivo: string }>;
  resumir(perfil: Perfil, historial: Turno[]): Promise<ResultadoResumen>;
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

  async resumir(perfil: Perfil, historial: Turno[]) {
    const transcripcion = historial.length
      ? historial.map((t) => `${t.de === "adulto" ? perfil.comoLlamarle : "Acompaña"}: ${t.texto}`).join("\n")
      : "(No contestó hoy.)";
    const r = await this.cliente.messages.create({
      model: env.modelo,
      max_tokens: 900,
      system: instruccionesResumen({ comoLlamarle: perfil.comoLlamarle, nombreFamiliar: perfil.nombreFamiliar, fechaLarga: perfil.fechaLarga }),
      tools: [herramientaResumir],
      tool_choice: { type: "tool", name: "resumir" },
      messages: [{ role: "user", content: `Esta es la plática de hoy:\n\n${transcripcion}` }],
    });
    const x = entradaDeHerramienta<{
      resumen: string; nivel: Nivel; medicinaTomada: DatosResumen["medicinaTomada"]; animo: DatosResumen["animo"];
      comio: DatosResumen["comio"]; temasDeSalud: string[]; cosasBonitas: string[]; pendientes: string[]; memoria: string[];
    }>(r, "resumir");
    return {
      resumen: x.resumen.trim(),
      nivel: x.nivel,
      memoria: x.memoria ?? [],
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
