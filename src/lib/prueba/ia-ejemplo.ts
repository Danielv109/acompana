import type { IA, ResultadoResumen, Turno } from "../ai/ia";
import type { Perfil } from "../ai/instrucciones";
import { detectarSenales, nivelMaximo, type Nivel } from "../ai/senales";

/**
 * IA de ejemplo para el modo prueba cuando no hay clave de Anthropic.
 * No entiende de verdad: contesta con frases preparadas. Sirve para probar el recorrido completo
 * (saludo, plática, resumen, avisos, página) sin gastar. Con ANTHROPIC_API_KEY se usa la IA real.
 */
export class IAEjemplo implements IA {
  async responder(perfil: Perfil, historial: Turno[]) {
    const deElla = historial.filter((t) => t.de === "adulto");
    const ultimo = (deElla.at(-1)?.texto ?? "").toLowerCase();
    const nombre = perfil.comoLlamarle;
    const senales = detectarSenales(ultimo);

    if (senales.some((s) => s.nivel === "rojo")) {
      return { mensaje: `${nombre}, eso me preocupa. Si es una emergencia, llame al 911 o pida ayuda a alguien cercano ahorita. Ya le estoy avisando a su familia.`, terminar: false };
    }
    if (/adi[oó]s|ya me voy|hasta luego|hasta ma[nñ]ana|bye/.test(ultimo)) {
      return { mensaje: `Que tenga muy bonito día, ${nombre}. Aquí estoy cuando quiera platicar.`, terminar: true };
    }
    if (senales.length) {
      return { mensaje: `Ay, ${nombre}, qué pena. ¿Desde cuándo se siente así? Si quiere, le aviso a ${perfil.nombreFamiliar.split(" ")[0]} para que le llame.`, terminar: false };
    }
    if (perfil.recados.length && deElla.length === 1) {
      return { mensaje: `Qué gusto saludarla, ${nombre}. Oiga, le manda decir ${perfil.recados[0]}`, terminar: false };
    }
    const preguntas = [
      `Qué gusto, ${nombre}. ¿Y ya desayunó? ¿Qué preparó hoy?`,
      `¿Y qué tal durmió? ¿Ya se tomó su pastilla de la mañana?`,
      perfil.personas[0] ? `Oiga, ¿y cómo sigue ${perfil.personas[0].split(" (")[0]}?` : `¿Y qué planes tiene para hoy?`,
      perfil.preguntaHistoria ? `Le quería preguntar algo: ${perfil.preguntaHistoria}` : `¡Qué bonito! Cuénteme más.`,
    ];
    const n = deElla.length - 1;
    if (n >= preguntas.length) return { mensaje: `Me encantó platicar con usted, ${nombre}. Le escribo mañana. Cuídese mucho.`, terminar: true };
    return { mensaje: preguntas[n], terminar: false };
  }

  async iniciar(perfil: Perfil, _historial: Turno[], motivo: string) {
    return /cita/.test(motivo)
      ? `Hola, ${perfil.comoLlamarle}. ¿Cómo le fue en su cita? ¿Qué le dijo el doctor?`
      : `Hola, ${perfil.comoLlamarle}. ¿Cómo va su día?`;
  }

  async clasificar(_c: string, mensaje: string) {
    const senales = detectarSenales(mensaje);
    return { nivel: nivelMaximo("verde", ...senales.map((s) => s.nivel)), motivo: senales[0]?.motivo ?? "" };
  }

  async resumir(perfil: Perfil, historial: Turno[], contexto?: { citasPorPreguntar: string[] }): Promise<ResultadoResumen> {
    const deElla = historial.filter((t) => t.de === "adulto").map((t) => t.texto);
    const senales = deElla.flatMap((t) => detectarSenales(t));
    const nivel: Nivel = nivelMaximo("verde", ...senales.map((s) => s.nivel));
    const nombre = perfil.comoLlamarle;
    const cita = deElla.slice(0, 2).map((t) => `«${t}»`).join(" y ");
    const resumen = deElla.length === 0
      ? `Hoy ${nombre} no contestó.`
      : `${nombre} platicó un rato (${deElla.length} ${deElla.length === 1 ? "mensaje" : "mensajes"}). Dijo ${cita}.${senales.length ? ` Mencionó algo para atender: ${senales.map((s) => s.motivo.toLowerCase()).join(", ")}.` : ""} (Resumen de ejemplo: con la clave de Anthropic, la IA escribe uno de verdad.)`;
    const aviso = deElla.length === 0
      ? `Hoy ${nombre} no contestó.`
      : senales.length ? `${nombre} platicó y mencionó: ${senales[0].motivo.toLowerCase()}. Llámale cuando puedas.` : `${nombre} platicó un rato y se oyó bien.`;
    const delDoctor = contexto?.citasPorPreguntar.length ? deElla.find((t) => /doctor|m[eé]dic|cita|presi[oó]n|az[uú]car/i.test(t)) ?? "" : "";
    return {
      resumen, aviso, importante: nivel !== "verde" || Boolean(delDoctor), nivel,
      memoria: deElla.length ? [`Ayer dijo: ${deElla.at(-1)}`] : [],
      personas: [], loQueContoDelDoctor: delDoctor, historia: null,
      datos: { medicinaTomada: "no_se_sabe", animo: "no_se_sabe", comio: "no_se_sabe", temasDeSalud: senales.map((s) => s.motivo), cosasBonitas: [], pendientes: [] },
    };
  }
}
