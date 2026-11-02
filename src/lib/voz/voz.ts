import OpenAI, { toFile } from "openai";
import { env } from "../env";

/** Voz a texto (para entender sus notas de voz) y texto a voz (para responderle). */
export interface Voz {
  transcribir(audio: Buffer, mime: string): Promise<string>;
  /** Devuelve audio OGG/Opus, el formato de las notas de voz de WhatsApp. */
  sintetizar(texto: string): Promise<Buffer>;
}

export class VozOpenAI implements Voz {
  private cliente: OpenAI;
  constructor(cliente?: OpenAI) {
    this.cliente = cliente ?? new OpenAI({ apiKey: env.openaiKey });
  }

  async transcribir(audio: Buffer, mime: string) {
    const extension = mime.includes("ogg") ? "ogg" : mime.includes("mpeg") ? "mp3" : mime.includes("mp4") ? "m4a" : "ogg";
    const archivo = await toFile(audio, `nota.${extension}`, { type: mime });
    const r = await this.cliente.audio.transcriptions.create({
      file: archivo,
      model: env.sttModelo,
      language: "es",
      // Pistas para que entienda mejor nombres y palabras comunes en estas pláticas
      prompt: "Plática con una persona mayor en México sobre cómo amaneció, su salud, sus medicinas y su familia.",
    });
    return r.text.trim();
  }

  async sintetizar(texto: string) {
    const r = await this.cliente.audio.speech.create({
      model: env.ttsModelo,
      voice: env.ttsVoz as "nova",
      input: texto,
      response_format: "opus",
      speed: 0.92, // un poco más lento: se entiende mejor
    });
    return Buffer.from(await r.arrayBuffer());
  }
}

let voz: Voz | null = null;
export function getVoz(): Voz {
  if (!voz) voz = new VozOpenAI();
  return voz;
}
export function usarVoz(nueva: Voz) {
  voz = nueva;
}
