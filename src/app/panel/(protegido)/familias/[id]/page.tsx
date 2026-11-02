import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adultos, contactos, familias, fichasEmergencia, medicinas, platicas, recados, resumenes } from "@/lib/db/schema";
import { telefonoBonito } from "@/lib/telefono";
import { fechaLarga } from "@/lib/tiempo";
import estilos from "../../../panel.module.css";
import {
  agregarContacto, agregarMedicina, cambiarActivo, guardarAjustes, guardarFicha,
  quitarContacto, quitarMedicina, registrarConsentimiento,
} from "../../../acciones";

const ESTADO = { prueba: "En prueba", activa: "Activa", pausada: "Pausada", cancelada: "Cancelada" } as const;

export default async function Familia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [familia] = await db.select().from(familias).where(eq(familias.id, id));
  if (!familia) notFound();
  const [adulto] = await db.select().from(adultos).where(eq(adultos.familiaId, id));
  const cs = await db.select().from(contactos).where(eq(contactos.familiaId, id)).orderBy(asc(contactos.orden));
  const ficha = adulto ? (await db.select().from(fichasEmergencia).where(eq(fichasEmergencia.adultoId, adulto.id)))[0] : undefined;
  const meds = adulto ? await db.select().from(medicinas).where(eq(medicinas.adultoId, adulto.id)) : [];
  const listaRecados = adulto ? await db.select().from(recados).where(eq(recados.adultoId, adulto.id)).orderBy(desc(recados.creadoEn)).limit(10) : [];
  const historial = adulto
    ? await db.select({ resumen: resumenes, platica: platicas }).from(resumenes)
        .innerJoin(platicas, eq(resumenes.platicaId, platicas.id))
        .where(eq(platicas.adultoId, adulto.id)).orderBy(desc(platicas.fecha)).limit(14)
    : [];

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 style={{ fontSize: "2rem", margin: 0 }}>{adulto ? adulto.comoLlamarle : familia.nombreContacto}</h1>
        <p>Familia de {familia.nombreContacto} · {familia.email} · {ESTADO[familia.estado]}{familia.pruebaTerminaEn && familia.estado === "prueba" ? ` hasta el ${familia.pruebaTerminaEn.toLocaleDateString("es-MX")}` : ""}</p>
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
              {adulto.consentimientoEn && (
                <form action={cambiarActivo}>
                  <input type="hidden" name="id" value={adulto.id} />
                  <input type="hidden" name="activo" value={adulto.activo ? "0" : "1"} />
                  <button className="boton boton-secundario boton-chico" type="submit">{adulto.activo ? "Pausar llamadas" : "Reanudar llamadas"}</button>
                </form>
              )}
            </div>
            <div>
              <details className={estilos.editar}>
                <summary>Editar ajustes</summary>
                <form action={guardarAjustes}>
                  <input type="hidden" name="id" value={adulto.id} />
                  <input type="hidden" name="familiaId" value={familia.id} />
                  <div className="campo"><label htmlFor="comoLlamarle">Cómo le decimos</label><input id="comoLlamarle" name="comoLlamarle" type="text" defaultValue={adulto.comoLlamarle} required /></div>
                  <div className="campo"><label htmlFor="horaSaludo">Hora del saludo</label><input id="horaSaludo" name="horaSaludo" type="time" defaultValue={adulto.horaSaludo} required /></div>
                  <div className="campo">
                    <label htmlFor="canal">Responde por</label>
                    <select id="canal" name="canal" defaultValue={adulto.canal}><option value="voz">Notas de voz</option><option value="texto">Texto</option></select>
                  </div>
                  <div className="campo"><label htmlFor="sobreElla">Sobre ella</label><textarea id="sobreElla" name="sobreElla" defaultValue={adulto.sobreElla} /></div>
                  <button className="boton boton-principal boton-chico" type="submit">Guardar ajustes</button>
                </form>
              </details>
            </div>
          </div>
        </section>
      )}

      {adulto && (
        <section className={estilos.tarjeta}>
          <div className={estilos.columnas}>
            <div>
              <h3>Medicinas</h3>
              {meds.length === 0 ? <p>Sin medicinas registradas.</p> : (
                <ul className={estilos.lista}>
                  {meds.map((m) => (
                    <li key={m.id} className={estilos.filaAccion}>
                      <span><b>{m.nombre}</b>{m.dosis && ` · ${m.dosis}`}{m.horario && ` · ${m.horario}`}</span>
                      <form action={quitarMedicina}>
                        <input type="hidden" name="id" value={m.id} /><input type="hidden" name="familiaId" value={familia.id} />
                        <button className={estilos.quitar} type="submit" aria-label={`Quitar ${m.nombre}`}>Quitar</button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <details className={estilos.editar}>
                <summary>Agregar medicina</summary>
                <form action={agregarMedicina}>
                  <input type="hidden" name="adultoId" value={adulto.id} /><input type="hidden" name="familiaId" value={familia.id} />
                  <div className="campo"><label htmlFor="med-nombre">Medicina</label><input id="med-nombre" name="nombre" type="text" required /></div>
                  <div className="campo"><label htmlFor="med-dosis">Dosis</label><input id="med-dosis" name="dosis" type="text" placeholder="50 mg" /></div>
                  <div className="campo"><label htmlFor="med-horario">Cuándo</label><input id="med-horario" name="horario" type="text" placeholder="En la mañana" /></div>
                  <button className="boton boton-principal boton-chico" type="submit">Agregar</button>
                </form>
              </details>
            </div>
            <div>
              <h3>Ficha de emergencia</h3>
              <form action={guardarFicha}>
                <input type="hidden" name="adultoId" value={adulto.id} /><input type="hidden" name="familiaId" value={familia.id} />
                {([
                  ["direccion", "Dirección"], ["referencias", "Referencias"], ["enfermedades", "Enfermedades"], ["alergias", "Alergias"],
                  ["tipoSangre", "Tipo de sangre"], ["seguro", "Seguro"], ["hospitalCercano", "Hospital cercano"], ["quienTieneLlave", "Quién tiene llave"],
                ] as const).map(([campo, etiqueta]) => (
                  <div className={estilos.campoCompacto} key={campo}>
                    <label htmlFor={`f-${campo}`}>{etiqueta}</label>
                    <input id={`f-${campo}`} name={campo} type="text" defaultValue={ficha?.[campo] ?? ""} />
                  </div>
                ))}
                <button className="boton boton-secundario boton-chico" type="submit">Guardar ficha</button>
              </form>
            </div>
          </div>
        </section>
      )}

      <section className={estilos.tarjeta}>
        <h3>Contactos</h3>
        <ul className={estilos.lista}>
          {cs.map((c) => (
            <li key={c.id} className={estilos.filaAccion}>
              <span>
                <b>{c.nombre}</b> ({c.relacion}) · {telefonoBonito(c.telefono)}
                <span className={estilos.meta}> · {[c.recibeResumen && "recibe resúmenes", c.recibeAlertas && "recibe alertas", c.puedeAcudir && "puede acudir"].filter(Boolean).join(", ") || "sin avisos"}</span>
              </span>
              {cs.length > 1 && (
                <form action={quitarContacto}>
                  <input type="hidden" name="id" value={c.id} /><input type="hidden" name="familiaId" value={familia.id} />
                  <button className={estilos.quitar} type="submit" aria-label={`Quitar a ${c.nombre}`}>Quitar</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <details className={estilos.editar}>
          <summary>Agregar contacto</summary>
          <form action={agregarContacto}>
            <input type="hidden" name="familiaId" value={familia.id} />
            <div className={estilos.columnas} style={{ gap: 16 }}>
              <div className="campo"><label htmlFor="c-nombre">Nombre</label><input id="c-nombre" name="nombre" type="text" required /></div>
              <div className="campo"><label htmlFor="c-relacion">Qué es de ella</label><input id="c-relacion" name="relacion" type="text" placeholder="Hija, vecino…" /></div>
            </div>
            <div className="campo"><label htmlFor="c-telefono">WhatsApp</label><input id="c-telefono" name="telefono" type="tel" required /></div>
            <label className="casilla"><input type="checkbox" name="recibeResumen" value="si" defaultChecked /> <span>Recibe los resúmenes</span></label>
            <label className="casilla"><input type="checkbox" name="recibeAlertas" value="si" defaultChecked /> <span>Recibe alertas rojas</span></label>
            <label className="casilla"><input type="checkbox" name="puedeAcudir" value="si" /> <span>Vive cerca y puede ir a verla</span></label>
            <button className="boton boton-principal boton-chico" type="submit">Agregar contacto</button>
          </form>
        </details>
      </section>

      {listaRecados.length > 0 && (
        <section className={estilos.tarjeta}>
          <h3>Recados de la familia</h3>
          <ul className={estilos.lista}>
            {listaRecados.map((r) => (
              <li key={r.id}>
                <b>{r.deQuien}:</b> {r.texto} <span className={estilos.meta}>· {r.entregadoEn ? `entregado el ${r.entregadoEn.toLocaleDateString("es-MX")}` : "pendiente para la próxima plática"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
