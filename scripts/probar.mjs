// Arranca Acompaña en modo prueba: base de datos local, WhatsApp y voz simulados.
// Uso: npm run probar  →  abre http://localhost:3000/panel/probar
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";

if (existsSync(".env")) {
  try { process.loadEnvFile(".env"); } catch { /* sigue con lo que haya */ }
}

/** Busca un puerto libre desde "desde" (por si ya hay otra base abierta, como npm run db:local). */
const puertoLibre = (desde) => new Promise((ok) => {
  const s = net.createServer();
  s.once("error", () => ok(puertoLibre(desde + 1)));
  s.listen(desde, "127.0.0.1", () => s.close(() => ok(desde)));
});
const PUERTO_DB = await puertoLibre(5434);
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

let dbTermino = false;
db.on("exit", () => { dbTermino = true; });

const listo = () => new Promise((ok) => {
  const s = net.connect(PUERTO_DB, "127.0.0.1", () => { s.end(); ok(true); });
  s.on("error", () => ok(false));
});
for (let i = 0; i < 60 && !dbTermino && !(await listo()); i++) await new Promise((r) => setTimeout(r, 500));
if (dbTermino || !(await listo())) {
  console.error("No arrancó la base de datos local. Cierra otras terminales con Acompaña abierto y vuelve a intentar.");
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
