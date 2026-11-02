import { describe, expect, it } from "vitest";
import { normalizarTelefono, esTelefonoValido, telefonoBonito } from "../src/lib/telefono";
import { ahoraEnZona, fechaLarga, minutosDeHora } from "../src/lib/tiempo";
import { detectarSenales, nivelMaximo } from "../src/lib/ai/senales";
import { extraerMensajes, firmaValida } from "../src/lib/whatsapp/webhook";
import { limpiarParametro } from "../src/lib/acompana";
import { createHmac } from "node:crypto";

describe("teléfonos", () => {
  it("normaliza números mexicanos, con o sin lada y con el 1 extra de WhatsApp", () => {
    expect(normalizarTelefono("618 123 4567")).toBe("526181234567");
    expect(normalizarTelefono("+52 1 618 123 4567")).toBe("526181234567");
    expect(normalizarTelefono("5216181234567")).toBe("526181234567");
    expect(normalizarTelefono("+1 (310) 555-1234")).toBe("13105551234");
  });
  it("valida y da formato", () => {
    expect(esTelefonoValido("6181234567")).toBe(true);
    expect(esTelefonoValido("12345")).toBe(false);
    expect(telefonoBonito("526181234567")).toBe("+52 618 123 4567");
  });
});

describe("tiempo", () => {
  it("calcula la hora local de México aunque el servidor esté en UTC", () => {
    const r = ahoraEnZona("America/Mexico_City", new Date("2026-11-02T15:05:00Z"));
    expect(r.fecha).toBe("2026-11-02");
    expect(r.hora).toBe("09:05");
  });
  it("cambia de día en la zona local, no en UTC", () => {
    expect(ahoraEnZona("America/Mexico_City", new Date("2026-11-03T03:00:00Z")).fecha).toBe("2026-11-02");
  });
  it("convierte horas y fechas", () => {
    expect(minutosDeHora("09:30")).toBe(570);
    expect(fechaLarga("2026-11-02")).toBe("lunes 2 de noviembre");
  });
});

describe("señales de alerta sin IA", () => {
  it("detecta emergencias", () => {
    expect(nivelMaximo(...detectarSenales("Me caí en el baño y no me puedo levantar").map((s) => s.nivel))).toBe("rojo");
    expect(detectarSenales("Siento como que me aprieta el pecho")[0]?.nivel).toBe("rojo");
    expect(detectarSenales("ya no quiero vivir, mijo")[0]?.nivel).toBe("rojo");
  });
  it("detecta cosas preocupantes", () => {
    expect(detectarSenales("Me hablaron del banco y me pidieron mi NIP").map((s) => s.nivel)).toContain("amarillo");
    expect(detectarSenales("Hoy no he comido nada")[0]?.nivel).toBe("amarillo");
    expect(detectarSenales("Me siento muy sola")[0]?.nivel).toBe("amarillo");
  });
  it("no se confunde con expresiones comunes", () => {
    expect(detectarSenales("Ay, me caí de la risa con la novela")).toHaveLength(0);
    expect(detectarSenales("Amanecí muy bien, ya regué mis plantas")).toHaveLength(0);
    expect(detectarSenales("Ya me dieron el código postal nuevo")).toHaveLength(0);
  });
});

describe("webhook de WhatsApp", () => {
  const aviso = {
    entry: [{ changes: [{ value: {
      messages: [
        { from: "5216189998877", id: "wamid.1", type: "text", text: { body: "Buenos días" } },
        { from: "5216189998877", id: "wamid.2", type: "audio", audio: { id: "media.1", mime_type: "audio/ogg; codecs=opus" } },
      ],
      statuses: [{ id: "wamid.x", status: "read" }],
    } }] }],
  };
  it("extrae textos y notas de voz, e ignora estados", () => {
    const ms = extraerMensajes(aviso);
    expect(ms).toHaveLength(2);
    expect(ms[0]).toMatchObject({ tipo: "texto", de: "526189998877", texto: "Buenos días" });
    expect(ms[1]).toMatchObject({ tipo: "audio", mediaId: "media.1" });
  });
  it("verifica la firma de Meta", () => {
    const cuerpo = JSON.stringify(aviso);
    const firma = "sha256=" + createHmac("sha256", "secreto").update(cuerpo).digest("hex");
    expect(firmaValida(cuerpo, firma, "secreto")).toBe(true);
    expect(firmaValida(cuerpo, "sha256=" + "0".repeat(64), "secreto")).toBe(false);
    expect(firmaValida(cuerpo, null, "secreto")).toBe(false);
  });
  it("limpia parámetros de plantillas (sin saltos de línea)", () => {
    expect(limpiarParametro("Hola\n\nmundo\t!")).toBe("Hola mundo !");
  });
});

describe("sesión del panel", () => {
  it("acepta tokens firmados y vigentes, rechaza alterados o vencidos", async () => {
    process.env.SESSION_SECRET = "secreto-de-prueba";
    process.env.ADMIN_PASSWORD = "clave";
    const { crearToken, leerToken, contrasenaCorrecta } = await import("../src/lib/sesion");
    const t = crearToken("Daniel", 1000);
    expect(leerToken(t, 2000)).toEqual({ nombre: "Daniel" });
    expect(leerToken(t.slice(0, -2) + "00", 2000)).toBeNull();
    expect(leerToken(t, 1000 + 15 * 24 * 3600 * 1000)).toBeNull();
    expect(contrasenaCorrecta("clave")).toBe(true);
    expect(contrasenaCorrecta("otra")).toBe(false);
  });
});
