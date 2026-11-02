import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adultos, contactos, familias, fichasEmergencia, medicinas, platicas, resumenes } from "@/lib/db/schema";
import { telefonoBonito } from "@/lib/telefono";
import { fechaLarga } from "@/lib/tiempo";
import estilos from "../../../panel.module.css";
import { cambiarActivo, registrarConsentimiento } from "../../../acciones";

export default async function Familia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [familia] = await db.select().from(familias).where(eq(familias.id, id));
  if (!familia) notFound();
  const [adulto] = await db.select().from(adultos).where(eq(adultos.familiaId, id));
  const cs = await db.select().from(contactos).where(eq(contactos.familiaId, id)).orderBy(asc(contactos.orden));
  const ficha = adulto ? (await db.select().from(fichasEmergencia).where(eq(fichasEmergencia.adultoId, adulto.id)))[0] : undefined;
  const meds = adulto ? await db.select().from(medicinas).where(eq(medicinas.adultoId, adulto.id)) : [];
  const historial = adulto
    ? await db.select({ resumen: resumenes, platica: platicas }).from(resumenes)
        .innerJoin(platicas, eq(resumenes.platicaId, platicas.id))
        .where(eq(platicas.adultoId, adulto.id)).orderBy(desc(platicas.fecha)).limit(14)
    : [];

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 style={{ fontSize: "2rem", margin: 0 }}>{adulto ? adulto.comoLlamarle : familia.nombreContacto}</h1>
        <p>Familia de {familia.nombreContacto} · {familia.email}</p>
      </div>

      {adulto && !adulto.consentimientoEn && (
        <section className={`${estilos.tarjeta} ${estilos.tarjetaAmarilla}`}>
          <h3>Falta el consentimiento de {adulto.comoLlamarle}</h3>
          <p>Las llamadas no empiezan hasta registrar su consentimiento expreso y por escrito (la ley lo exige para datos de salud). Hazlo en la videollamada de bienvenida.</p>
          <form action={registrarConsentimiento} className={estilos.acciones}>
            <input type="hidden" name="id" value={adulto.id} />
            <select name="metodo" required defaultValue="" style={{ maxWidth: 360 }}>
              <option value="" disabled>¿Cómo lo dio?</option>
              <option value="Firma electrónica">Firma electrónica</option>
              <option value="Firma autógrafa (documento escaneado)">Firma autógrafa (documento escaneado)</option>
              <option value="Mensaje escrito por WhatsApp desde su número">Mensaje escrito por WhatsApp desde su número</option>
            </select>
            <button className="boton boton-principal boton-chico" type="submit">Registrar y activar llamadas</button>
          </form>
        </section>
      )}

      {adulto && (
        <section className={estilos.tarjeta}>
          <div className={estilos.columnas}>
            <div>
              <h3>{adulto.nombre}</h3>
              <dl className={estilos.ficha}>
                <dt>WhatsApp</dt><dd>{telefonoBonito(adulto.telefono)}</dd>
                <dt>Saludo diario</dt><dd>{adulto.horaSaludo} ({adulto.zonaHoraria})</dd>
                <dt>Responde por</dt><dd>{adulto.canal === "voz" ? "Notas de voz" : "Texto"}</dd>
                <dt>Consentimiento</dt><dd>{adulto.consentimientoEn ? `${adulto.consentimientoEn.toLocaleDateString("es-MX")} · ${adulto.consentimientoMetodo}` : "Pendiente"}</dd>
              </dl>
              {adulto.sobreElla && <p style={{ marginTop: 14 }}><b>Sobre ella:</b> {adulto.sobreElla}</p>}
              {meds.length > 0 && <p><b>Medicinas:</b> {meds.map((m) => `${m.nombre} ${m.dosis} (${m.horario})`).join("; ")}</p>}
              {adulto.consentimientoEn && (
                <form action={cambiarActivo}>
                  <input type="hidden" name="id" value={adulto.id} />
                  <input type="hidden" name="activo" value={adulto.activo ? "0" : "1"} />
                  <button className="boton boton-secundario boton-chico" type="submit">{adulto.activo ? "Pausar llamadas" : "Reanudar llamadas"}</button>
                </form>
              )}
            </div>
            <div>
              <h3>Ficha de emergencia</h3>
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
              ) : <p>Sin ficha.</p>}
            </div>
          </div>
        </section>
      )}

      <section className={estilos.tarjeta}>
        <h3>Contactos</h3>
        <ul className={estilos.lista}>
          {cs.map((c) => (
            <li key={c.id}>
              <b>{c.nombre}</b> ({c.relacion}) · {telefonoBonito(c.telefono)}
              <span className={estilos.meta}> · {[c.recibeResumen && "recibe resúmenes", c.recibeAlertas && "recibe alertas", c.puedeAcudir && "puede acudir"].filter(Boolean).join(", ")}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={estilos.tarjeta}>
        <h3>Últimos días</h3>
        {historial.length === 0 ? <p>Todavía no hay pláticas.</p> : (
          <ul className={estilos.lista}>
            {historial.map(({ resumen, platica }) => (
              <li key={resumen.id}>
                <span className={`nivel nivel-${resumen.nivel}`}>{resumen.nivel}</span>{" "}
                <b>{fechaLarga(platica.fecha)}</b> <span className={estilos.meta}>({resumen.estado})</span>
                <p style={{ margin: "6px 0 0" }}>{resumen.textoFinal ?? resumen.textoBorrador}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
