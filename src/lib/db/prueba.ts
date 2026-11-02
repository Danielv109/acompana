import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import { usarDb, type Db } from "./client";

/**
 * Base de datos del modo prueba: PGlite dentro del mismo proceso, guardada en la carpeta .pglite.
 * Crea las tablas que falten al arrancar. Solo se usa con MODO_PRUEBA=si.
 */
export async function prepararBaseDePrueba() {
  const carpeta = path.join(process.cwd(), ".pglite");
  const pg = new PGlite(carpeta);
  const db = drizzle(pg, { schema }) as unknown as Db;
  await migrate(db as never, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  usarDb(db);
  console.log(`Base de prueba lista en ${carpeta}`);
}
