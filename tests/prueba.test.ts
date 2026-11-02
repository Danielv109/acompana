import { describe, expect, it } from "vitest";
import { IAEjemplo } from "../src/lib/prueba/ia-ejemplo";
import { textoDePlantilla } from "../src/lib/whatsapp/plantillas";

const nombres = { saludo: "saludo_diario", reintento: "saludo_reintento", resumen: "resumen_diario", alerta: "alerta_familia", avisoInterno: "aviso_interno", recordatorio: "recordatorio_familia", bienvenida: "bienvenida_familia" };
const perfil = { nombre: "Rosa", comoLlamarle: "Doña Rosa", sobreElla: "", medicinas: [], memoria: [], fechaLarga: "lunes 2 de noviembre", nombreFamiliar: "Juan (su hijo)", personas: [], temas: [], preguntaHistoria: null };

describe("modo prueba", () => {
  it("muestra cada plantilla con el texto que vería la persona", () => {
    const t = textoDePlantilla("resumen_diario", ["Doña Rosa", "lunes 2 de noviembre", "Amaneció bien.", "abc"], "http://localhost:3000/", nombres);
    expect(t).toContain("Amaneció bien.");
    expect(t).toContain("http://localhost:3000/mama/abc");
    expect(textoDePlantilla("otra", ["x"], "", nombres)).toContain("[Plantilla otra]");
  });

  it("la IA de ejemplo responde a una emergencia y resume con el nivel correcto", async () => {
    const ia = new IAEjemplo();
    const r = await ia.responder(perfil, [{ de: "adulto", texto: "Me caí en el baño" }]);
    expect(r.mensaje).toContain("911");
    const res = await ia.resumir(perfil, [{ de: "adulto", texto: "Me caí en el baño" }]);
    expect(res.nivel).toBe("rojo");
    expect(res.importante).toBe(true);
    expect((await ia.responder(perfil, [{ de: "adulto", texto: "Ya me voy, adiós" }])).terminar).toBe(true);
  });
});
