// Arranca Acompaña en modo prueba: WhatsApp y voz simulados, y la base de datos dentro de la app
// (carpeta .pglite, sin puertos ni servidor aparte).
// Uso: npm run probar  →  abre http://localhost:3000/panel/probar
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".env")) {
  try { process.loadEnvFile(".env"); } catch { /* sigue con lo que haya */ }
}

const PUERTO_APP = process.env.PUERTO ?? "3000";
const entorno = {
  ...process.env,
  MODO_PRUEBA: "si",
  // El modo prueba nunca toca una base real aunque tu .env tenga otra
  DATABASE_URL: "pglite:.pglite",
  APP_URL: `http://localhost:${PUERTO_APP}`,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "prueba",
  SESSION_SECRET: process.env.SESSION_SECRET || "secreto-solo-para-pruebas-locales",
  CRON_SECRET: process.env.CRON_SECRET || "prueba",
  ADMIN_WHATSAPP: process.env.ADMIN_WHATSAPP || "5210000000000",
};

console.log(`
  ─────────────────────────────────────────────
  Acompaña en modo prueba
  Abre:        http://localhost:${PUERTO_APP}/panel/probar
  Nombre:      el tuyo
  Contraseña:  ${entorno.ADMIN_PASSWORD}
  IA:          ${process.env.ANTHROPIC_API_KEY ? "la real (Anthropic)" : "de ejemplo (pon ANTHROPIC_API_KEY en .env para la real)"}
  Para salir:  Ctrl + C
  ─────────────────────────────────────────────
`);

const app = spawn("npx", ["next", "dev", "-p", PUERTO_APP], { stdio: "inherit", shell: true, env: entorno });
app.on("exit", (codigo) => process.exit(codigo ?? 0));
process.on("SIGINT", () => app.kill("SIGINT"));
process.on("SIGTERM", () => app.kill("SIGTERM"));
