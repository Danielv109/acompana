/** Fecha y hora local de una zona horaria, sin depender de la zona del servidor. */
export function ahoraEnZona(zona: string, ahora: Date = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(ahora);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "00";
  const fecha = `${p("year")}-${p("month")}-${p("day")}`;
  const minutos = Number(p("hour")) * 60 + Number(p("minute"));
  return { fecha, minutos, hora: `${p("hour")}:${p("minute")}` };
}

export function minutosDeHora(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutosEntre(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / 60000;
}

const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "lunes 3 de noviembre" a partir de "2026-11-03" */
export function fechaLarga(fechaIso: string): string {
  const [y, m, d] = fechaIso.split("-").map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${dias[dia]} ${d} de ${meses[m - 1]}`;
}
