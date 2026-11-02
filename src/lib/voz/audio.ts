import { OggOpusDecoder } from "ogg-opus-decoder";

/**
 * Las notas de voz de WhatsApp llegan en OGG/Opus.
 * El modelo de transcripción recomendado no acepta OGG, así que las convertimos a WAV (sin perder calidad).
 */
export async function oggAWav(ogg: Uint8Array): Promise<Buffer> {
  const decoder = new OggOpusDecoder({ forceStereo: false });
  await decoder.ready;
  try {
    const { channelData, sampleRate, samplesDecoded } = await decoder.decodeFile(ogg);
    if (!samplesDecoded || !channelData.length) throw new Error("La nota de voz está vacía o dañada.");
    return pcmAWav(mezclarAMono(channelData), sampleRate);
  } finally {
    decoder.free();
  }
}

function mezclarAMono(canales: Float32Array[]): Float32Array {
  if (canales.length === 1) return canales[0];
  const n = canales[0].length;
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let suma = 0;
    for (const c of canales) suma += c[i] ?? 0;
    mono[i] = suma / canales.length;
  }
  return mono;
}

/** WAV de 16 bits, un canal. */
export function pcmAWav(muestras: Float32Array, sampleRate: number): Buffer {
  const datos = muestras.length * 2;
  const b = Buffer.alloc(44 + datos);
  b.write("RIFF", 0); b.writeUInt32LE(36 + datos, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sampleRate, 24); b.writeUInt32LE(sampleRate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(datos, 40);
  for (let i = 0; i < muestras.length; i++) {
    const s = Math.max(-1, Math.min(1, muestras[i]));
    b.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), 44 + i * 2);
  }
  return b;
}
