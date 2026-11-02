import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { historias } from "@/lib/db/schema";
import { familiaPorToken } from "../../../datos";

export const runtime = "nodejs";

/** Sirve la nota de voz de una historia, solo a quien tiene el enlace privado de la familia. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; historiaId: string; n: string }> }) {
  const { token, historiaId, n } = await params;
  const r = await familiaPorToken(token);
  if (!r || !/^[0-9a-f-]{36}$/.test(historiaId)) return new Response("No encontrado", { status: 404 });
  const [h] = await getDb().select().from(historias).where(and(eq(historias.id, historiaId), eq(historias.adultoId, r.adulto.id)));
  const audio = h?.audios.at(Number(n));
  if (!audio) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(audio.base64, "base64")), {
    headers: { "Content-Type": audio.mime.split(";")[0], "Cache-Control": "private, max-age=86400" },
  });
}
