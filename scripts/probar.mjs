// Arranca Acompaña en modo prueba: base de datos local, WhatsApp y voz simulados.
// Uso: npm run probar  →  abre http://localhost:3000/panel/probar
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";

if (existsSync(".env")) {
  try { process.loadEnvFile(".env"); } catch { /* sigue con lo que haya */ }
}

const PUERTO_DB = 5433;
const PUERTO_APP = process.env.PUERTO ?? "3000";
const entorno = {
  ...process.env,
  MODO_PRUEBA: "si",
  // Siempre la base local: el modo prueba nunca toca una base real aunque tu .env tenga otra
  DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${PUERTO_DB}/postgres`,
  APP_URL: `http://localhost:${PUERTO_APP}`,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "prueba",
  SESSION_SECRET: process.env.SESSION_SECRET || "secreto-solo-para-pruebas-locales",
  CRON_SECRET: process.env.CRON_SECRET || "prueba",
  ADMIN_WHATSAPP: process.env.ADMIN_WHATSAPP || "5210000000000",
};

const opciones = { stdio: "inherit", shell: true, env: entorno };
const db = spawn("npx", ["pglite-server", "--db=.pglite", `-p`, String(PUERTO_DB), "-m", "10"], opciones);

const listo = () => new Promise((ok) => {
  const s = net.connect(PUERTO_DB, "127.0.0.1", () => { s.end(); ok(true); });
  s.on("error", () => ok(false));
});
for (let i = 0; i < 60 && !(await listo()); i++) await new Promise((r) => setTimeout(r, 500));
if (!(await listo())) {
  console.error("No arrancó la base de datos local. ¿Está ocupado el puerto 5433?");
  db.kill();
  process.exit(1);
}

const migrar = spawnSync("npx", ["drizzle-kit", "migrate"], opciones);
if (migrar.status !== 0) {
  console.error("No se pudo preparar la base de datos.");
  db.kill();
  process.exit(1);
}

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

const app = spawn("npx", ["next", "dev", "-p", PUERTO_APP], opciones);
const salir = () => { app.kill(); db.kill(); process.exit(0); };
process.on("SIGINT", salir);
process.on("SIGTERM", salir);
app.on("exit", () => { db.kill(); process.exit(0); });
