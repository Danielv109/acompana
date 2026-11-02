import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizarTelefono } from "../telefono";

export type Entrante =
  | { tipo: "texto"; de: string; id: string; texto: string }
  | { tipo: "audio"; de: string; id: string; mediaId: string; mime: string }
  | { tipo: "otro"; de: string; id: string; descripcion: string };

/** Verifica que el aviso realmente venga de Meta (encabezado X-Hub-Signature-256). */
export function firmaValida(cuerpo: string, firma: string | null, secreto: string): boolean {
  // Sin secreto no se puede verificar: solo se permite en desarrollo
  if (!secreto) return process.env.NODE_ENV !== "production";
  if (!firma?.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", secreto).update(cuerpo, "utf8").digest("hex");
  const a = Buffer.from(firma.slice(7), "hex");
  const b = Buffer.from(esperada, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Saca los mensajes que nos interesan del aviso de WhatsApp. Ignora estados (entregado, leído). */
export function extraerMensajes(aviso: any): Entrante[] {
  const salida: Entrante[] = [];
  for (const entrada of aviso?.entry ?? []) {
    for (const cambio of entrada?.changes ?? []) {
      for (const m of cambio?.value?.messages ?? []) {
        const de = normalizarTelefono(String(m.from ?? ""));
        const id = String(m.id ?? "");
        if (!de || !id) continue;
        if (m.type === "text" && m.text?.body) {
          salida.push({ tipo: "texto", de, id, texto: String(m.text.body) });
        } else if (m.type === "audio" && m.audio?.id) {
          salida.push({ tipo: "audio", de, id, mediaId: String(m.audio.id), mime: String(m.audio.mime_type ?? "audio/ogg") });
        } else if (m.type === "button" && m.button?.text) {
          salida.push({ tipo: "texto", de, id, texto: String(m.button.text) });
        } else if (m.type === "interactive") {
          const t = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title;
          if (t) salida.push({ tipo: "texto", de, id, texto: String(t) });
          else salida.push({ tipo: "otro", de, id, descripcion: "interactivo" });
        } else {
          salida.push({ tipo: "otro", de, id, descripcion: String(m.type ?? "desconocido") });
        }
      }
    }
  }
  return salida;
}
