import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adultos, mensajes, platicas, resumenes } from "@/lib/db/schema";
import { fechaLarga } from "@/lib/tiempo";
import estilos from "../panel.module.css";
import { RevisarResumen } from "./revisar";
import { descartarResumen } from "../acciones";

const ORDEN = { rojo: 0, amarillo: 1, verde: 2 } as const;
const ETIQUETA = {
  medicinaTomada: { si: "Tomó su medicina", no: "No tomó su medicina", no_se_sabe: null },
  comio: { si: "Comió", no: "No ha comido", no_se_sabe: null },
  animo: { bien: "Ánimo: bien", regular: "Ánimo: regular", decaido: "Ánimo: decaída", no_se_sabe: null },
} as const;

export default async function Pendientes() {
  const db = getDb();
  const filas = await db
    .select({ resumen: resumenes, platica: platicas, adulto: adultos })
    .from(resumenes)
    .innerJoin(platicas, eq(resumenes.platicaId, platicas.id))
    .innerJoin(adultos, eq(platicas.adultoId, adultos.id))
    .where(eq(resumenes.estado, "pendiente"))
    .orderBy(asc(resumenes.creadoEn));
  filas.sort((a, b) => ORDEN[a.resumen.nivel] - ORDEN[b.resumen.nivel]);

  const ids = filas.map((f) => f.platica.id);
  const todos = ids.length
    ? await db.select().from(mensajes).where(inArray(mensajes.platicaId, ids)).orderBy(asc(mensajes.creadoEn))
    : [];

  return (
    <>
      <div className={estilos.encabezado}>
        <h1 style={{ fontSize: "2rem", margin: 0 }}>Resúmenes por revisar</h1>
        <p>{filas.length === 0 ? "Nada pendiente." : `${filas.length} por revisar. Primero los rojos y amarillos.`}</p>
      </div>

      {filas.length === 0 && (
        <div className={estilos.vacio}>
          <p style={{ margin: "0 auto" }}>Cuando termine una plática, su resumen aparece aquí para que lo revises antes de enviarlo.</p>
        </div>
      )}

      {filas.map(({ resumen, platica, adulto }) => {
        const datos = resumen.datos;
        const chips = [
          ETIQUETA.medicinaTomada[datos.medicinaTomada],
          ETIQUETA.comio[datos.comio],
          ETIQUETA.animo[datos.animo],
          ...datos.temasDeSalud.map((t) => `Salud: ${t}`),
        ].filter(Boolean) as string[];
        const turnos = todos.filter((m) => m.platicaId === platica.id);
        const clase = resumen.nivel === "rojo" ? estilos.tarjetaRoja : resumen.nivel === "amarillo" ? estilos.tarjetaAmarilla : "";
        return (
          <article key={resumen.id} className={`${estilos.tarjeta} ${clase}`}>
            <div className={estilos.cabeza}>
              <span className={`nivel nivel-${resumen.nivel}`}>{resumen.nivel}</span>
              <h3>{adulto.comoLlamarle}</h3>
              <span className={estilos.meta}>{adulto.nombre} · {fechaLarga(platica.fecha)} · {platica.estado.replace("_", " ")}</span>
            </div>
            <div className={estilos.columnas}>
              <div>
                <h4 style={{ margin: "0 0 8px" }}>Lo que platicaron</h4>
                <div className={estilos.transcripcion}>
                  {turnos.length === 0 && <p className={estilos.turno}>No contestó.</p>}
                  {turnos.map((m) => (
                    <p key={m.id} className={estilos.turno}>
                      <b>{m.de === "adulto" ? adulto.comoLlamarle : "Acompaña"}{m.tipo === "audio" ? " (voz)" : ""}:</b> {m.texto}
                    </p>
                  ))}
                </div>
                {datos.pendientes.length > 0 && (
                  <p style={{ marginTop: 12 }}><b>Para la familia:</b> {datos.pendientes.join("; ")}</p>
                )}
                {resumen.memoria && <p className={estilos.meta}><b>Para recordar mañana:</b> {resumen.memoria.replaceAll("\n", "; ")}</p>}
              </div>
              <div>
                {chips.length > 0 && <div className={estilos.datos}>{chips.map((c) => <span key={c} className={estilos.dato}>{c}</span>)}</div>}
                <RevisarResumen id={resumen.id} borrador={resumen.textoBorrador} />
                <form action={descartarResumen} style={{ marginTop: 10 }}>
                  <input type="hidden" name="id" value={resumen.id} />
                  <button className="boton boton-secundario boton-chico" type="submit">Descartar (no enviar)</button>
                </form>
              </div>
            </div>
          </article>
        );
      })}
    </>
  );
}
