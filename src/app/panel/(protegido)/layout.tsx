import type { Metadata } from "next";
import Link from "next/link";
import estilos from "../panel.module.css";
import { exigirSesion } from "@/lib/sesion";
import { salir } from "../acciones";

export const metadata: Metadata = { title: "Panel · Acompaña", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const sesion = await exigirSesion();
  return (
    <div className={estilos.marco}>
      <header className={estilos.barra}>
        <div className={`contenedor ${estilos.barraInterior}`}>
          <Link href="/panel" className={estilos.logo}>Acompaña</Link>
          <nav className={estilos.nav} aria-label="Secciones del panel">
            <Link href="/panel">Resúmenes por revisar</Link>
            <Link href="/panel/alertas">Alertas</Link>
            <Link href="/panel/familias">Familias</Link>
          </nav>
          <form action={salir}>
            <button className={estilos.salir} type="submit">Salir ({sesion.nombre})</button>
          </form>
        </div>
      </header>
      <main className={`contenedor ${estilos.contenido}`}>{children}</main>
    </div>
  );
}
