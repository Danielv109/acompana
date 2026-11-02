import OpenAI, { toFile } from "openai";
import { env } from "../env";
import { oggAWav } from "./audio";

/** Voz a texto (para entender sus notas de voz) y texto a voz (para responderle). */
export interface Voz {
  transcribir(audio: Buffer, mime: string): Promise<string>;
  /** Devuelve OGG/Opus mono: el formato de las notas de voz de WhatsApp. */
  sintetizar(texto: string): Promise<Buffer>;
}

const CONTEXTO_TRANSCRIPCION =
  "Plática por WhatsApp con una persona mayor en México: cómo amaneció, su salud, sus medicinas, su comida, su familia y sus vecinos.";

// ─── Voz a texto: OpenAI ─────────────────────────────────────

/**
 * Usa "gpt-transcribe" (el modelo recomendado por OpenAI desde 2026).
 * whisper-1 y gpt-4o-transcribe dejan de funcionar el 26 de febrero de 2027.
 */
export async function transcribirConOpenAI(cliente: OpenAI, audio: Buffer, mime: string, modelo: string): Promise<string> {
  const esNuevo = modelo.startsWith("gpt-transcribe");
  let archivo: Buffer = audio;
  let nombre = "nota.ogg";
  let tipo = mime.split(";")[0] || "audio/ogg";
  if (esNuevo && tipo.includes("ogg")) {
    // gpt-transcribe no acepta OGG: lo convertimos a WAV
    archivo = await oggAWav(new Uint8Array(audio));
    nombre = "nota.wav";
    tipo = "audio/wav";
  } else if (tipo.includes("mpeg")) nombre = "nota.mp3";
  else if (tipo.includes("mp4") || tipo.includes("m4a")) nombre = "nota.m4a";
  else if (tipo.includes("amr")) nombre = "nota.amr";
  else if (tipo.includes("aac")) nombre = "nota.aac";

  const file = await toFile(archivo, nombre, { type: tipo });
  const base = { model: modelo, file, prompt: CONTEXTO_TRANSCRIPCION };
  const r = esNuevo
    ? await cliente.audio.transcriptions.create(base, { body: { ...base, languages: ["es"] } })
    : await cliente.audio.transcriptions.create({ ...base, language: "es" });
  return r.text.trim();
}

// ─── Texto a voz: Azure (acento mexicano) ────────────────────

function escaparXml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function ssml(texto: string, voz: string, velocidad: string): string {
  return `<speak version='1.0' xml:lang='es-MX'><voice name='${voz}'><prosody rate='${velocidad}'>${escaparXml(texto)}</prosody></voice></speak>`;
}

export async function sintetizarConAzure(texto: string): Promise<Buffer> {
  const r = await fetch(`https://${env.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": env.azureKey,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "ogg-24khz-16bit-mono-opus",
      "User-Agent": "acompana",
    },
    body: ssml(texto, env.azureVoz, env.azureVelocidad),
  });
  if (!r.ok) throw new Error(`Azure respondió ${r.status}: ${await r.text().catch(() => "")}`);
  return Buffer.from(await r.arrayBuffer());
}

// ─── Texto a voz: OpenAI (alternativa) ───────────────────────

/** Nota: los modelos de voz actuales de OpenAI se retiran el 6 de enero de 2027. */
export async function sintetizarConOpenAI(cliente: OpenAI, texto: string): Promise<Buffer> {
  const r = await cliente.audio.speech.create({
    model: env.ttsModelo,
    voice: env.ttsVoz as "marin",
    input: texto,
    instructions:
      "Habla en español de México, con calidez y respeto, como una persona amable que conoce a quien escucha. Ritmo natural y claro, sin exagerar la lentitud ni usar tono infantil.",
    response_format: "opus",
  });
  return Buffer.from(await r.arrayBuffer());
}

// ─── Implementación configurada ──────────────────────────────

export class VozConfigurada implements Voz {
  private openai: OpenAI | null = null;
  private cliente() {
    if (!this.openai) this.openai = new OpenAI({ apiKey: env.openaiKey });
    return this.openai;
  }
  transcribir(audio: Buffer, mime: string) {
    return transcribirConOpenAI(this.cliente(), audio, mime, env.sttModelo);
  }
  sintetizar(texto: string) {
    return env.vozProveedor === "openai" ? sintetizarConOpenAI(this.cliente(), texto) : sintetizarConAzure(texto);
  }
}

let voz: Voz | null = null;
export function getVoz(): Voz {
  if (!voz) voz = new VozConfigurada();
  return voz;
}
export function usarVoz(nueva: Voz) {
  voz = nueva;
}
