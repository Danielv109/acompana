import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { env } from "../env";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Se guarda en globalThis para que todas las partes del servidor compartan la misma conexión
const global = globalThis as unknown as { __acompanaDb?: Db };

/** Conexión única a Postgres (se reutiliza entre peticiones). */
export function getDb(): Db {
  if (!global.__acompanaDb) {
    if (env.modoPrueba) throw new Error("La base de prueba no está lista. Arranca con: npm run probar");
    const cliente = postgres(env.databaseUrl, { max: 5, prepare: false });
    global.__acompanaDb = drizzle(cliente, { schema }) as unknown as Db;
  }
  return global.__acompanaDb;
}

/** Usar otra base de datos (pruebas automáticas y modo prueba, con PGlite). */
export function usarDb(db: Db) {
  global.__acompanaDb = db;
}

export { schema };
