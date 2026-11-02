import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adultos, familias } from "@/lib/db/schema";

/** El enlace privado es la llave: si el token no existe, no hay nada que ver. */
export async function familiaPorToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return null;
  const db = getDb();
  const [familia] = await db.select().from(familias).where(eq(familias.tokenPagina, token));
  if (!familia || familia.estado === "cancelada") return null;
  const [adulto] = await db.select().from(adultos).where(eq(adultos.familiaId, familia.id));
  if (!adulto) return null;
  return { familia, adulto };
}
