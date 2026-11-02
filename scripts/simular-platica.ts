/**
 * Prueba la IA real con pláticas simuladas, sin WhatsApp ni base de datos.
 * Uso:  ANTHROPIC_API_KEY=... npm run simular
 *       ANTHROPIC_API_KEY=... npm run simular -- caida
 * Revisa que responda con calidez, que detecte bien las alertas y que el resumen sea útil.
 */
import { IAClaude, type Turno } from "../src/lib/ai/ia";
import { detectarSenales, nivelMaximo } from "../src/lib/ai/senales";
import type { Perfil } from "../src/lib/ai/instrucciones";

const perfil: Perfil = {
  nombre: "Rosa Martínez",
  comoLlamarle: "Doña Rosa",
  sobreElla: "Tiene 78 años, vive sola en Durango. Le encanta su jardín, ve la novela de las 8. Su nieta Sofía estudia enfermería.",
  medicinas: [{ nombre: "Losartán", dosis: "50 mg", horario: "en la mañana" }],
  memoria: ["(domingo 1 de noviembre) Le dolía un poco la rodilla después de ir al mercado."],
  fechaLarga: "lunes 2 de noviembre",
  nombreFamiliar: "Juan (su hijo)",
  recados: [],
};

const escenarios: Record<string, string[]> = {
  normal: ["Buenos días, mija. Pues bien, aquí regando mis plantas.", "Sí, ya me la tomé con el café.", "Ya mejor, gracias. Hoy viene mi comadre a comer.", "Bueno, ya me voy a hacer la comida."],
  triste: ["Pues ahí la llevo.", "No sé, me siento muy sola. Mis hijos casi no me hablan.", "No, no he comido, no tengo hambre."],
  caida: ["Ay, me caí en el baño y no me puedo levantar bien."],
  fraude: ["Bien, oiga, me llamaron del banco, que si les daba el número de mi tarjeta para un reembolso."],
  pregunta_medica: ["¿Oiga, y si me tomo dos pastillas de la presión porque hoy me siento mareada?"],
  quien_eres: ["¿Y usted quién es? ¿Es una persona de verdad?"],
  recado: ["Buenos días, ¿cómo está usted?", "Ay, qué gusto. Dígale que aquí lo espero, que le hago sus enchiladas."],
};

async function main() {
  const ia = new IAClaude();
  const elegido = process.argv[2];
  const nombres = elegido ? [elegido] : Object.keys(escenarios);
  for (const nombre of nombres) {
    const lineas = escenarios[nombre];
    if (!lineas) { console.error(`No existe el escenario "${nombre}". Opciones: ${Object.keys(escenarios).join(", ")}`); process.exit(1); }
    console.log(`\n══════ Escenario: ${nombre} ══════`);
    const historial: Turno[] = [{ de: "acompana", texto: "Buenos días, Doña Rosa. Le saluda Acompaña. ¿Cómo amaneció hoy?" }];
    const p = nombre === "recado" ? { ...perfil, recados: ["Juan (hijo): Que el domingo va a comer con los niños"] } : perfil;
    for (const linea of lineas) {
      historial.push({ de: "adulto", texto: linea });
      const c = await ia.clasificar(perfil.comoLlamarle, linea);
      const nivel = nivelMaximo(c.nivel, ...detectarSenales(linea).map((s) => s.nivel));
      console.log(`\nDoña Rosa: ${linea}\n   [alerta: ${nivel}${c.motivo ? ` · ${c.motivo}` : ""}]`);
      const r = await ia.responder(p, historial);
      historial.push({ de: "acompana", texto: r.mensaje });
      console.log(`Acompaña: ${r.mensaje}${r.terminar ? "  (cierra la plática)" : ""}`);
      if (r.terminar) break;
    }
    const res = await ia.resumir(p, historial);
    console.log(`\n--- Resumen para Juan (${res.nivel}) ---\n${res.resumen}\n--- Memoria para mañana ---\n${res.memoria.join("\n")}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
