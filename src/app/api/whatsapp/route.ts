import { NextResponse, after } from "next/server";
import { env } from "@/lib/env";
import { extraerMensajes, firmaValida } from "@/lib/whatsapp/webhook";
import { depsReales, procesarEntrante } from "@/lib/acompana";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Meta llama aquí una vez para verificar el webhook. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const modo = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const reto = url.searchParams.get("hub.challenge");
  if (modo === "subscribe" && token === env.whatsappVerifyToken && reto) {
    return new Response(reto, { status: 200 });
  }
  return new Response("Token de verificación incorrecto", { status: 403 });
}

/** Cada mensaje que llega por WhatsApp. Respondemos 200 rápido y procesamos después. */
export async function POST(req: Request) {
  const cuerpo = await req.text();
  if (!firmaValida(cuerpo, req.headers.get("x-hub-signature-256"), env.whatsappAppSecret)) {
    return new Response("Firma inválida", { status: 401 });
  }
  let aviso: unknown;
  try {
    aviso = JSON.parse(cuerpo);
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }
  const mensajes = extraerMensajes(aviso);
  if (mensajes.length) {
    after(async () => {
      const d = depsReales();
      for (const m of mensajes) {
        try {
          await procesarEntrante(d, m);
        } catch (e) {
          console.error("Error procesando mensaje de WhatsApp", m.id, e);
        }
      }
    });
  }
  return NextResponse.json({ ok: true });
}
