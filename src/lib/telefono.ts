/**
 * Números de WhatsApp.
 * Guardamos todo como dígitos con lada internacional, sin "+":
 *   México: 52 + 10 dígitos  → 526181234567
 *   EE.UU.: 1 + 10 dígitos   → 13105551234
 * WhatsApp a veces manda los celulares mexicanos con un "1" extra (521...). Lo quitamos.
 */
export function normalizarTelefono(entrada: string, ladaPorDefecto = "52"): string {
  let d = entrada.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10) d = ladaPorDefecto + d;
  if (d.length === 13 && d.startsWith("521")) d = "52" + d.slice(3);
  return d;
}

export function esTelefonoValido(d: string): boolean {
  const n = normalizarTelefono(d);
  return (n.startsWith("52") && n.length === 12) || (n.startsWith("1") && n.length === 11);
}

/** Formato bonito para mostrar: +52 618 123 4567 */
export function telefonoBonito(d: string): string {
  const n = normalizarTelefono(d);
  if (n.startsWith("52") && n.length === 12) return `+52 ${n.slice(2, 5)} ${n.slice(5, 8)} ${n.slice(8)}`;
  if (n.startsWith("1") && n.length === 11) return `+1 ${n.slice(1, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
  return `+${n}`;
}
