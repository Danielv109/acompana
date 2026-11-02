import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adultos, alertas, contactos, fichasEmergencia } from "@/lib/db/schema";
import { telefonoBonito } from "@/lib/telefono";
import estilos from "../../panel.module.css";
import { atenderAlerta } from "../../acciones";

function hace(fecha: Date): string {
  const min = Math.round((Date.now() - fecha.getTime()) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}

export default async function Alertas() {
  const db = getDb();
  const abiertas = await db
    .select({ alerta: alertas, adulto: adultos, ficha: fichasEmergencia })
    .from(alertas)
    .innerJoin(adultos, eq(alertas.adultoId, adultos.id))
    .leftJoin(fichasEmergencia, eq(fichasEmergencia.adultoId, adultos.id))
    .where(eq(alertas.estado, "abierta"))
    .orderBy(desc(alertas.creadaEn));
  abiertas.sort((a, b) => (a.alerta.nivel === b.alerta.nivel ? 0 : a.alerta.nivel === "rojo" ? -1 : 1));

  const recientes = await db
    .select({ alerta: alertas, adulto: adultos })
    .from(alertas)
    .innerJoin(adultos, eq(alertas.adultoId, adultos.id))
    .where(eq(alertas.estado, "atendida"))
    .orderBy(desc(alertas.atendidaEn))
    .limit(15);

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 style={{ fontSize: "2rem", margin: 0 }}>Alertas</h1>
        <p>{abiertas.length === 0 ? "Sin alertas abiertas." : `${abiertas.length} ${abiertas.length === 1 ? "abierta" : "abiertas"}.`}</p>
      </div>

      {abiertas.length === 0 && <div className={estilos.vacio}><p style={{ margin: "0 auto" }}>Todo en calma. Cuando alguien mencione algo preocupante, aparece aquí y te llega un WhatsApp.</p></div>}

      {await Promise.all(abiertas.map(async ({ alerta, adulto, ficha }) => {
        const cs = await db.select().from(contactos).where(eq(contactos.familiaId, adulto.familiaId)).orderBy(asc(contactos.orden));
        const roja = alerta.nivel === "rojo";
        return (
          <article key={alerta.id} className={`${estilos.tarjeta} ${roja ? estilos.tarjetaRoja : estilos.tarjetaAmarilla}`}>
            <div className={estilos.cabeza}>
              <span className={`nivel nivel-${alerta.nivel}`}>{alerta.nivel}</span>
              <h3>{adulto.comoLlamarle}: {alerta.motivo}</h3>
              <span className={estilos.meta}>{hace(alerta.creadaEn)}</span>
            </div>
            {alerta.frase && <p><b>Lo que dijo:</b> “{alerta.frase}”</p>}

            {roja && (
              <div className={estilos.protocolo}>
                <b>Protocolo de alerta roja</b>
                <ol>
                  <li>Llama a {adulto.comoLlamarle} ahora: <a href={`tel:+${adulto.telefono}`}>{telefonoBonito(adulto.telefono)}</a>.</li>
                  <li>Si no contesta o confirma la emergencia, llama al contacto que puede acudir.</li>
                  <li>Con permiso de la familia, llama al 911 y dicta la ficha de emergencia.</li>
                  <li>Anota lo que hiciste y marca la alerta como atendida.</li>
                </ol>
              </div>
            )}

            <div className={estilos.columnas}>
              <div>
                <h4 style={{ margin: "0 0 8px" }}>Contactos</h4>
                <ul className={estilos.lista}>
                  <li><b>{adulto.comoLlamarle}</b> · <a href={`tel:+${adulto.telefono}`}>{telefonoBonito(adulto.telefono)}</a></li>
                  {cs.map((c) => (
                    <li key={c.id}>
                      <b>{c.nombre}</b> ({c.relacion}{c.puedeAcudir ? ", puede acudir" : ""}) · <a href={`tel:+${c.telefono}`}>{telefonoBonito(c.telefono)}</a> · <a href={`https://wa.me/${c.telefono}`} target="_blank" rel="noreferrer">WhatsApp</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 style={{ margin: "0 0 8px" }}>Ficha de emergencia</h4>
                {ficha ? (
                  <dl className={estilos.ficha}>
                    <dt>Dirección</dt><dd>{ficha.direccion || "—"}</dd>
                    <dt>Referencias</dt><dd>{ficha.referencias || "—"}</dd>
                    <dt>Enfermedades</dt><dd>{ficha.enfermedades || "—"}</dd>
                    <dt>Alergias</dt><dd>{ficha.alergias || "—"}</dd>
                    <dt>Tipo de sangre</dt><dd>{ficha.tipoSangre || "—"}</dd>
                    <dt>Seguro</dt><dd>{ficha.seguro || "—"}</dd>
                    <dt>Hospital cercano</dt><dd>{ficha.hospitalCercano || "—"}</dd>
                    <dt>Tiene llave</dt><dd>{ficha.quienTieneLlave || "—"}</dd>
                  </dl>
                ) : <p>Sin ficha registrada.</p>}
              </div>
            </div>

            <form action={atenderAlerta} style={{ marginTop: 18 }}>
              <input type="hidden" name="id" value={alerta.id} />
              <label htmlFor={`nota-${alerta.id}`}>Qué se hizo</label>
              <textarea id={`nota-${alerta.id}`} name="nota" rows={2} placeholder="Ej. Le llamé, estaba bien, solo se resbaló. Avisé a Juan." style={{ minHeight: 80 }} />
              <div className={estilos.acciones}>
                <button className="boton boton-principal boton-chico" type="submit">Marcar como atendida</button>
              </div>
            </form>
          </article>
        );
      }))}

      {recientes.length > 0 && (
        <>
          <h2 style={{ fontSize: "1.4rem", marginTop: 40 }}>Atendidas recientemente</h2>
          <table className={estilos.tabla}>
            <thead><tr><th>Nivel</th><th>Quién</th><th>Motivo</th><th>Qué se hizo</th></tr></thead>
            <tbody>
              {recientes.map(({ alerta, adulto }) => (
                <tr key={alerta.id}>
                  <td><span className={`nivel nivel-${alerta.nivel}`}>{alerta.nivel}</span></td>
                  <td>{adulto.comoLlamarle}</td>
                  <td>{alerta.motivo}</td>
                  <td>{alerta.notaAtencion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
