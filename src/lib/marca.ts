/**
 * Datos del negocio que aparecen en la página. Cámbialos aquí y se actualizan en todos lados.
 */
export const marca = {
  nombre: "Acompaña",
  fundador: "Daniel", // tu nombre como quieres que lo vean las familias
  ciudad: "Durango",
  correo: "hola@acompana.mx",
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_CONTACTO ?? "",
  precios: {
    basico: { mxn: 499, usd: 29 },
    completo: { mxn: 899, usd: 49 },
  },
  precioFundador: { mxn: 349, usd: 20, lugares: 30 },
  diasDePrueba: 14,
  /** Tu historia, en primera persona. Cámbiala por la tuya: es lo que más confianza da. */
  historia: [
    "Soy Daniel y estudio programación en Durango. Empecé Acompaña porque en México más de 1.7 millones de personas mayores viven solas, y muchos de sus hijos vivimos lejos y con la preocupación encima.",
    "Mientras seamos pocas familias, yo leo personalmente cada plática y reviso cada resumen antes de que te llegue. Si tienes una duda, escríbeme directo: te contesto yo.",
  ],
};

export function enlaceWhatsApp(texto = "Hola, quiero saber más de Acompaña para mi mamá."): string {
  return `https://wa.me/${marca.whatsapp}?text=${encodeURIComponent(texto)}`;
}
