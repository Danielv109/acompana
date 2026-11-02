import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { oggAWav } from "../src/lib/voz/audio";

describe("notas de voz", () => {
  it("convierte una nota OGG/Opus de WhatsApp a WAV", async () => {
    const ogg = readFileSync(path.resolve(import.meta.dirname, "fixtures/nota.ogg"));
    const wav = await oggAWav(new Uint8Array(ogg));
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    const sampleRate = wav.readUInt32LE(24);
    const segundos = wav.readUInt32LE(40) / 2 / sampleRate;
    expect(segundos).toBeGreaterThan(1.3);
    expect(segundos).toBeLessThan(1.7);
  });
  it("avisa si el archivo no es una nota válida", async () => {
    await expect(oggAWav(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow();
  });
});
