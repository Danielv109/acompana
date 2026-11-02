import { getDb } from "../db/client";
import { bandeja } from "../db/schema";
import { env } from "../env";
import type { Mensajero } from "../whatsapp/mensajero";
import { textoDePlantilla } from "../whatsapp/plantillas";
import type { Voz } from "../voz/voz";

const MARCA_VOZ = "VOZ-SIMULADA:";

/** En modo prueba, nada sale a WhatsApp: cada mensaje se guarda en la bandeja del celular simulado. */
export class WhatsAppSimulado implements Mensajero {
  private async guardar(telefono: string, tipo: "texto" | "audio" | "plantilla", texto: string) {
    const [fila] = await getDb().insert(bandeja).values({ telefono, direccion: "sale", tipo, texto }).returning({ id: bandeja.id });
    return `simulado.${fila.id}`;
  }
  enviarTexto(para: string, texto: string) {
    return this.guardar(para, "texto", texto);
  }
  enviarAudio(para: string, audio: Buffer) {
    const contenido = audio.toString("utf8");
    return this.guardar(para, "audio", contenido.startsWith(MARCA_VOZ) ? contenido.slice(MARCA_VOZ.length) : "(nota de voz)");
  }
  enviarPlantilla(para: string, plantilla: string, parametros: string[]) {
    const nombres = {
      saludo: env.plantillaSaludo, reintento: env.plantillaReintento, resumen: env.plantillaResumen, alerta: env.plantillaAlerta,
      avisoInterno: env.plantillaAvisoInterno, recordatorio: env.plantillaRecordatorio, bienvenida: env.plantillaBienvenida,
    };
    return this.guardar(para, "plantilla", textoDePlantilla(plantilla, parametros, env.appUrl, nombres));
  }
  async descargarMedia(): Promise<{ datos: Buffer; mime: string }> {
    throw new Error("En el modo prueba solo se escribe texto.");
  }
  async marcarLeido() {}
}

/** La "nota de voz" de prueba lleva el texto adentro, para mostrarlo en el simulador. */
export class VozSimulada implements Voz {
  async transcribir() { return "(nota de voz)"; }
  async sintetizar(texto: string) { return Buffer.from(MARCA_VOZ + texto, "utf8"); }
}
