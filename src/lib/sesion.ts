import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "./env";

const COOKIE = "acompana_panel";
const DURACION_SEG = 60 * 60 * 24 * 14; // 14 días

function firmar(valor: string): string {
  return createHmac("sha256", env.sessionSecret).update(valor).digest("hex");
}

export function crearToken(nombre: string, ahora = Date.now()): string {
  const datos = Buffer.from(JSON.stringify({ n: nombre, e: ahora + DURACION_SEG * 1000 })).toString("base64url");
  return `${datos}.${firmar(datos)}`;
}

export function leerToken(token: string | undefined, ahora = Date.now()): { nombre: string } | null {
  if (!token) return null;
  const [datos, firma] = token.split(".");
  if (!datos || !firma) return null;
  const esperada = Buffer.from(firmar(datos), "hex");
  const dada = Buffer.from(firma, "hex");
  if (esperada.length !== dada.length || !timingSafeEqual(esperada, dada)) return null;
  try {
    const { n, e } = JSON.parse(Buffer.from(datos, "base64url").toString());
    if (typeof e !== "number" || e < ahora) return null;
    return { nombre: String(n) };
  } catch {
    return null;
  }
}

export function contrasenaCorrecta(dada: string): boolean {
  const a = Buffer.from(firmar(dada));
  const b = Buffer.from(firmar(env.adminPassword));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function iniciarSesion(nombre: string) {
  (await cookies()).set(COOKIE, crearToken(nombre), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: DURACION_SEG,
  });
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE);
}

/** Úsalo al inicio de cada página o acción del panel. */
export async function exigirSesion(): Promise<{ nombre: string }> {
  const sesion = leerToken((await cookies()).get(COOKIE)?.value);
  if (!sesion) redirect("/panel/entrar");
  return sesion;
}
