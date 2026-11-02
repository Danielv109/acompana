import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { depsReales, tick } from "@/lib/acompana";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Llamar cada 5 minutos. Acepta el secreto en el encabezado Authorization: Bearer <CRON_SECRET>
 * (así lo manda Vercel Cron) o en ?secreto=<CRON_SECRET> para servicios de cron externos.
 */
async function manejar(req: Request) {
  const url = new URL(req.url);
  const dado = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("secreto");
  if (dado !== env.cronSecret) return new Response("No autorizado", { status: 401 });
  const resultado = await tick(depsReales());
  return NextResponse.json({ ok: true, ...resultado });
}

export const GET = manejar;
export const POST = manejar;
