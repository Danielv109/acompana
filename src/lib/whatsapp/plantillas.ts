/** Los parámetros de plantillas de WhatsApp no aceptan saltos de línea ni tabuladores. */
export function limpiarParametro(texto: string, max = 900): string {
  const limpio = texto.replace(/[\n\r\t]+/g, " ").replace(/ {4,}/g, "   ").trim();
  return limpio.length > max ? `${limpio.slice(0, max - 1)}…` : limpio;
}
