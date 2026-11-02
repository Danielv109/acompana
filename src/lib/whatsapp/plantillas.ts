/** Los parámetros de plantillas de WhatsApp no aceptan saltos de línea ni tabuladores. */
export function limpiarParametro(texto: string, max = 900): string {
  const limpio = texto.replace(/[\n\r\t]+/g, " ").replace(/ {4,}/g, "   ").trim();
  return limpio.length > max ? `${limpio.slice(0, max - 1)}…` : limpio;
}

/**
 * El texto con el que llega cada plantilla, igual que en docs/plantillas-whatsapp.md.
 * Lo usa el modo prueba para mostrar lo que vería la persona en su celular.
 */
export function textoDePlantilla(nombre: string, p: string[], appUrl: string, nombres: Record<string, string>): string {
  const pagina = (token: string) => `${appUrl.replace(/\/$/, "")}/mama/${token}`;
  const textos: Record<string, () => string> = {
    [nombres.saludo]: () => `Hola, ${p[0]}, le saluda Acompaña. ¿Cómo está hoy? Puede contestarme con una nota de voz, como si platicáramos.`,
    [nombres.reintento]: () => `Hola otra vez. ${p[0]}, solo quería saber cómo está. Cuando pueda, mándeme una nota de voz o un mensaje corto.`,
    [nombres.resumen]: () => `Resumen de ${p[0]} del ${p[1]}:\n\n${p[2]}\n\nDetalles en su página: ${pagina(p[3])}\nResponde "solo lo importante" si prefieres menos mensajes.`,
    [nombres.alerta]: () => `Aviso importante sobre ${p[0]}: ${p[1]}. Lo que dijo: "${p[2]}". Si es una emergencia, llama al 911 o pide a alguien cercano que vaya a verla. Nuestro equipo ya está intentando comunicarse con ella.`,
    [nombres.avisoInterno]: () => `Aviso de Acompaña: ${p[0]} (mensaje automático)`,
    [nombres.recordatorio]: () => `Recordatorio sobre ${p[0]}: ${p[1]} Si quieres ver todo, pregunta "¿cómo va?" en este chat.`,
    [nombres.bienvenida]: () => `Hola ${p[0]}, ya registramos a ${p[1]} en Acompaña. Esta es su página, donde puedes agregar sus medicinas y citas para que te recordemos a tiempo: ${pagina(p[2])} Te escribimos pronto para la videollamada de bienvenida.`,
  };
  return textos[nombre]?.() ?? `[Plantilla ${nombre}] ${p.join(" · ")}`;
}
