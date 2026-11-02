import type { Metadata } from "next";
import Link from "next/link";
import { FormularioAlta } from "./formulario";
import e from "./alta.module.css";

export const metadata: Metadata = { title: "Empieza tus 14 días gratis · Acompaña" };

export default async function Alta({ searchParams }: { searchParams: Promise<{ pago?: string }> }) {
  const { pago } = await searchParams;
  return (
    <main className={`contenedor ${e.pagina}`}>
      <Link href="/" className={e.volver}>Volver al inicio</Link>
      <div className={e.intro}>
        <h1>Empieza tus 14 días gratis</h1>
        <p>Toma unos 5 minutos. Con esto preparamos la primera plática para que se sienta natural desde el primer día.</p>
        {pago === "cancelado" && (
          <p role="status" style={{ color: "var(--amarillo)", fontWeight: 700 }}>
            No se completó el registro de tu tarjeta. Tus datos quedaron guardados; escríbenos y lo terminamos juntos.
          </p>
        )}
        <ol className={e.pasos}>
          <li>Llenas este registro</li>
          <li>Te contactamos para la videollamada</li>
          <li>Al día siguiente llega el primer saludo</li>
        </ol>
      </div>
      <FormularioAlta />
    </main>
  );
}
