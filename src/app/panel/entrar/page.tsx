import type { Metadata } from "next";
import estilos from "../panel.module.css";
import { FormularioEntrar } from "./formulario";

export const metadata: Metadata = { title: "Entrar · Panel de Acompaña", robots: { index: false } };

export default function Entrar() {
  return (
    <main className={estilos.marco}>
      <div className={estilos.login}>
        <h1 style={{ fontSize: "1.8rem" }}>Panel de revisión</h1>
        <p style={{ color: "var(--tinta-suave)" }}>Aquí revisas cada resumen antes de que llegue a la familia.</p>
        <FormularioEntrar />
      </div>
    </main>
  );
}
