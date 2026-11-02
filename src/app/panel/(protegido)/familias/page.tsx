import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adultos, familias } from "@/lib/db/schema";
import { telefonoBonito } from "@/lib/telefono";
import estilos from "../../panel.module.css";

const ESTADO = { prueba: "En prueba", activa: "Activa", pausada: "Pausada", cancelada: "Cancelada" } as const;

export default async function Familias() {
  const filas = await getDb()
    .select({ familia: familias, adulto: adultos })
    .from(familias)
    .leftJoin(adultos, eq(adultos.familiaId, familias.id))
    .orderBy(desc(familias.creadoEn));

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 style={{ fontSize: "2rem", margin: 0 }}>Familias</h1>
        <p>{filas.length} registradas</p>
      </div>
      {filas.length === 0 ? (
        <div className={estilos.vacio}><p style={{ margin: "0 auto" }}>Cuando una familia llene el formulario de alta, aparece aquí.</p></div>
      ) : (
        <table className={estilos.tabla}>
          <thead><tr><th>Adulto mayor</th><th>Familiar</th><th>Plan</th><th>Estado</th><th>Llamadas</th></tr></thead>
          <tbody>
            {filas.map(({ familia, adulto }) => (
              <tr key={familia.id}>
                <td><Link href={`/panel/familias/${familia.id}`}>{adulto ? `${adulto.comoLlamarle} (${adulto.nombre})` : "Sin adulto"}</Link></td>
                <td>{familia.nombreContacto}<br /><span className={estilos.meta}>{telefonoBonito(familia.telefono)}</span></td>
                <td>{familia.plan === "completo" ? "Completo" : "Básico"} · {familia.moneda.toUpperCase()}</td>
                <td>{ESTADO[familia.estado]}</td>
                <td>
                  {!adulto ? "—" : !adulto.consentimientoEn
                    ? <span className="nivel nivel-amarillo">Falta consentimiento</span>
                    : adulto.activo ? <span className="nivel nivel-verde">Activas a las {adulto.horaSaludo}</span> : "Pausadas"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
