import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { env } from "../env";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let instancia: Db | null = null;

/** Conexión única a Postgres (se reutiliza entre peticiones). */
export function getDb(): Db {
  if (!instancia) {
    const cliente = postgres(env.databaseUrl, { max: 5, prepare: false });
    instancia = drizzle(cliente, { schema }) as unknown as Db;
  }
  return instancia;
}

/** Solo para pruebas: usar otra base de datos (por ejemplo, PGlite en memoria). */
export function usarDb(db: Db) {
  instancia = db;
}

export { schema };
