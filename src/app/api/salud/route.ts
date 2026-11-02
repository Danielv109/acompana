import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NECESARIAS = [
  "DATABASE_URL", "APP_URL", "ADMIN_PASSWORD", "SESSION_SECRET", "ADMIN_WHATSAPP", "CRON_SECRET",
  "ANTHROPIC_API_KEY", "OPENAI_API_KEY",
  ...(process.env.VOZ_PROVEEDOR === "openai" ? [] : ["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"]),
  "WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET",
];
const OPCIONALES = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_WHATSAPP_CONTACTO"];

/** Revisa qué falta configurar. Solo dice sí o no; nunca muestra los valores. */
export async function GET() {
  const faltan = NECESARIAS.filter((n) => !process.env[n]);
  const opcionalesFaltantes = OPCIONALES.filter((n) => !process.env[n]);
  let baseDeDatos = "sin configurar";
  if (process.env.DATABASE_URL) {
    try {
      await getDb().execute(sql`select 1`);
      baseDeDatos = "conectada";
    } catch {
      baseDeDatos = "no se pudo conectar";
    }
  }
  return NextResponse.json({ listo: faltan.length === 0 && baseDeDatos === "conectada", baseDeDatos, faltan, opcionalesFaltantes });
}
