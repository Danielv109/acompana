/** Se ejecuta una vez al arrancar el servidor, antes de atender peticiones. */
export async function register() {
  // En modo prueba la base de datos vive dentro de la app (sin puertos ni servidor aparte)
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.MODO_PRUEBA === "si") {
    const { prepararBaseDePrueba } = await import("./lib/db/prueba");
    await prepararBaseDePrueba();
  }
}
