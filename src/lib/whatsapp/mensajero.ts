import { env } from "../env";

/** Todo lo que la app necesita para hablar por WhatsApp. En pruebas se usa una versión falsa. */
export interface Mensajero {
  enviarTexto(para: string, texto: string): Promise<string | null>;
  enviarAudio(para: string, audioOgg: Buffer): Promise<string | null>;
  enviarPlantilla(para: string, plantilla: string, parametros: string[]): Promise<string | null>;
  descargarMedia(mediaId: string): Promise<{ datos: Buffer; mime: string }>;
  marcarLeido(waMessageId: string): Promise<void>;
}

/** Cliente de la API oficial de WhatsApp Business (Cloud API de Meta). */
export class WhatsAppCloud implements Mensajero {
  private base() {
    return `https://graph.facebook.com/${env.whatsappVersion}`;
  }

  private async llamar(ruta: string, cuerpo: unknown): Promise<any> {
    const r = await fetch(`${this.base()}/${ruta}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.whatsappToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`WhatsApp respondió ${r.status}: ${JSON.stringify(json)}`);
    return json;
  }

  async enviarTexto(para: string, texto: string) {
    const r = await this.llamar(`${env.whatsappPhoneId}/messages`, {
      messaging_product: "whatsapp", to: para, type: "text", text: { body: texto, preview_url: false },
    });
    return r.messages?.[0]?.id ?? null;
  }

  async enviarAudio(para: string, audioOgg: Buffer) {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", "audio/ogg");
    form.append("file", new Blob([new Uint8Array(audioOgg)], { type: "audio/ogg" }), "nota.ogg");
    const subida = await fetch(`${this.base()}/${env.whatsappPhoneId}/media`, {
      method: "POST", headers: { Authorization: `Bearer ${env.whatsappToken}` }, body: form,
    });
    const media = await subida.json();
    if (!subida.ok) throw new Error(`No se pudo subir el audio: ${JSON.stringify(media)}`);
    const r = await this.llamar(`${env.whatsappPhoneId}/messages`, {
      messaging_product: "whatsapp", to: para, type: "audio", audio: { id: media.id },
    });
    return r.messages?.[0]?.id ?? null;
  }

  async enviarPlantilla(para: string, plantilla: string, parametros: string[]) {
    const r = await this.llamar(`${env.whatsappPhoneId}/messages`, {
      messaging_product: "whatsapp",
      to: para,
      type: "template",
      template: {
        name: plantilla,
        language: { code: env.idiomaPlantillas },
        components: parametros.length
          ? [{ type: "body", parameters: parametros.map((text) => ({ type: "text", text })) }]
          : [],
      },
    });
    return r.messages?.[0]?.id ?? null;
  }

  async descargarMedia(mediaId: string) {
    const info = await fetch(`${this.base()}/${mediaId}`, { headers: { Authorization: `Bearer ${env.whatsappToken}` } });
    const json = await info.json();
    if (!info.ok) throw new Error(`No se encontró el audio: ${JSON.stringify(json)}`);
    const archivo = await fetch(json.url, { headers: { Authorization: `Bearer ${env.whatsappToken}` } });
    if (!archivo.ok) throw new Error(`No se pudo descargar el audio (${archivo.status}).`);
    return { datos: Buffer.from(await archivo.arrayBuffer()), mime: json.mime_type ?? "audio/ogg" };
  }

  async marcarLeido(waMessageId: string) {
    await this.llamar(`${env.whatsappPhoneId}/messages`, {
      messaging_product: "whatsapp", status: "read", message_id: waMessageId,
    }).catch(() => undefined);
  }
}

let mensajero: Mensajero | null = null;
export function getMensajero(): Mensajero {
  if (!mensajero) mensajero = new WhatsAppCloud();
  return mensajero;
}
export function usarMensajero(nuevo: Mensajero) {
  mensajero = nuevo;
}
