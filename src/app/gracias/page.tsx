import type { Metadata } from "next";
import Link from "next/link";
import { enlaceWhatsApp, marca } from "@/lib/marca";
import e from "../legal.module.css";

export const metadata: Metadata = { title: "Registro recibido · Acompaña", robots: { index: false } };

export default function Gracias() {
  return (
    <main className={`contenedor ${e.centro}`}>
      <h1>Listo, ya tenemos tu registro</h1>
      <p>Esto es lo que sigue:</p>
      <ol>
        <li>En las próximas 24 horas {marca.fundador} te escribe por WhatsApp para agendar una videollamada corta contigo y con ella.</li>
        <li>En la videollamada le dejamos el teléfono listo, escucha la voz que la va a saludar y nos da su consentimiento.</li>
        <li>A la mañana siguiente llega su primer saludo, y a ti tu primer resumen.</li>
      </ol>
      <p>Tus {marca.diasDePrueba} días gratis cuentan desde hoy. Si la bienvenida se retrasa por nuestra parte, te reponemos esos días.</p>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 28 }}>
        <a className="boton boton-principal" href={enlaceWhatsApp("Hola, acabo de registrarme en Acompaña.")} target="_blank" rel="noreferrer">Escribirnos ahora</a>
        <Link className="boton boton-secundario" href="/">Volver al inicio</Link>
      </div>
    </main>
  );
}
