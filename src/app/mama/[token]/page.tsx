import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { citas, historias, medicinas, platicas, resumenes } from "@/lib/db/schema";
import { ahoraEnZona, cuandoEs, fechaLarga } from "@/lib/tiempo";
import { diasRestantes, RECORDATORIOS, textoDiasRestantes } from "@/lib/ficha";
import { enlaceWhatsApp, marca } from "@/lib/marca";
import { familiaPorToken } from "./datos";
import { agregarCita, agregarMedicina, cambiarAvisos, guardarSurtido, quitarCita, quitarMedicina, yaLaSurti } from "./acciones";
import e from "./mama.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Su página · Acompaña", robots: { index: false, follow: false } };

export default async function PaginaMama({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await familiaPorToken(token);
  if (!r) notFound();
  const { familia, adulto } = r;
  const db = getDb();
  const { fecha: hoy } = ahoraEnZona(adulto.zonaHoraria);

  const [ultimo] = await db.select({ texto: resumenes.textoFinal, fecha: platicas.fecha }).from(resumenes)
    .innerJoin(platicas, eq(resumenes.platicaId, platicas.id))
    .where(and(eq(platicas.adultoId, adulto.id), eq(resumenes.estado, "enviado")))
    .orderBy(desc(platicas.fecha)).limit(1);
  const meds = await db.select().from(medicinas).where(eq(medicinas.adultoId, adulto.id)).orderBy(asc(medicinas.nombre));
  const proximas = await db.select().from(citas).where(and(eq(citas.adultoId, adulto.id), gte(citas.fecha, hoy))).orderBy(asc(citas.fecha));
  const pasadas = await db.select().from(citas).where(and(eq(citas.adultoId, adulto.id), lt(citas.fecha, hoy))).orderBy(desc(citas.fecha)).limit(6);
  const suHistoria = await db.select().from(historias).where(eq(historias.adultoId, adulto.id)).orderBy(desc(historias.creadaEn));
  const oculto = <input type="hidden" name="token" value={token} />;

  return (
    <main className={e.pagina}>
      <header className={e.cabecera}>
        <div className="contenedor">
          <p className={e.marca}><span className={e.punto} aria-hidden="true" />{marca.nombre}</p>
          <h1>La página de {adulto.comoLlamarle}</h1>
          <p className={e.aviso}>Solo para su familia. No compartas este enlace fuera de ella.</p>
        </div>
      </header>

      <div className={`contenedor ${e.cuerpo}`}>
        <section className={e.bloque} aria-labelledby="lo-ultimo">
          <h2 id="lo-ultimo">Lo último</h2>
          {ultimo?.texto ? (
            <>
              <p className={e.cuando}>{cuandoEs(ultimo.fecha, hoy).replace(/^./, (x) => x.toUpperCase())}</p>
              <p className={e.resumen}>{ultimo.texto}</p>
            </>
          ) : (
            <p className={e.vacio}>Aquí vas a ver el resumen más reciente en cuanto empiecen sus pláticas.</p>
          )}
          <form action={cambiarAvisos} className={e.avisos}>
            {oculto}
            <p className={e.avisosTitulo}>¿Cuándo te escribimos por WhatsApp?</p>
            <div className={e.avisosOpciones}>
              <button type="submit" name="avisos" value="diario" aria-pressed={familia.avisos === "diario"} className={e.opcion}>Todos los días</button>
              <button type="submit" name="avisos" value="importante" aria-pressed={familia.avisos === "importante"} className={e.opcion}>Solo si hay algo importante</button>
            </div>
            <p className={e.detalle}>Las alertas y los recordatorios te llegan siempre. Lo de cada día queda aquí.</p>
          </form>
        </section>

        <section className={e.bloque} aria-labelledby="medicinas">
          <h2 id="medicinas">Sus medicinas</h2>
          <p className={e.explica}>
            Dinos cuándo la surtiste y cuántos días le dura, y te avisamos {RECORDATORIOS.diasAntesDeAcabarse} días antes de que se acabe. A ella nunca le hablamos de eso.
          </p>
          {meds.length === 0 && <p className={e.vacio}>Todavía no hay medicinas registradas.</p>}
          <ul className={e.lista}>
            {meds.map((m) => {
              const n = diasRestantes(m, hoy);
              const estado = n === null ? "sin-datos" : n <= RECORDATORIOS.diasAntesDeAcabarse ? "pronto" : "bien";
              return (
                <li key={m.id} className={e.medicina}>
                  <div className={e.medicinaCabeza}>
                    <div>
                      <p className={e.nombre}>{m.nombre}</p>
                      {(m.dosis || m.horario) && <p className={e.detalle}>{[m.dosis, m.horario].filter(Boolean).join(" · ")}</p>}
                    </div>
                    <span className={`${e.estado} ${e[`estado-${estado}`]}`}>{n === null ? "Falta decirnos cuándo la surtiste" : textoDiasRestantes(n).replace(/^le /, "Le ").replace(/^se /, "Se ")}</span>
                  </div>
                  <div className={e.medicinaAcciones}>
                    <form action={yaLaSurti}>
                      {oculto}<input type="hidden" name="id" value={m.id} />
                      <button className="boton boton-principal boton-chico" type="submit" disabled={!m.duraDias}>Ya la surtí hoy</button>
                    </form>
                    <details className={e.editar}>
                      <summary>Cambiar datos de surtido</summary>
                      <form action={guardarSurtido} className={e.formLinea}>
                        {oculto}<input type="hidden" name="id" value={m.id} />
                        <label>Surtida el<input type="date" name="ultimoSurtido" defaultValue={m.ultimoSurtido ?? ""} max={hoy} /></label>
                        <label>Le dura (días)<input type="number" name="duraDias" min={1} max={365} defaultValue={m.duraDias ?? ""} inputMode="numeric" /></label>
                        <button className="boton boton-secundario boton-chico" type="submit">Guardar</button>
                      </form>
                      <form action={quitarMedicina}>
                        {oculto}<input type="hidden" name="id" value={m.id} />
                        <button className={e.quitar} type="submit">Ya no la toma</button>
                      </form>
                    </details>
                  </div>
                </li>
              );
            })}
          </ul>
          <details className={e.agregar}>
            <summary>Agregar una medicina</summary>
            <form action={agregarMedicina} className={e.formGrid}>
              {oculto}
              <label>Nombre<input type="text" name="nombre" required placeholder="Losartán" /></label>
              <label>Dosis<input type="text" name="dosis" placeholder="50 mg" /></label>
              <label>Cuándo la toma<input type="text" name="horario" placeholder="En la mañana" /></label>
              <label>Surtida el<input type="date" name="ultimoSurtido" max={hoy} /></label>
              <label>Le dura (días)<input type="number" name="duraDias" min={1} max={365} inputMode="numeric" placeholder="30" /></label>
              <button className="boton boton-principal boton-chico" type="submit">Agregar medicina</button>
            </form>
          </details>
        </section>

        <section className={e.bloque} aria-labelledby="citas">
          <h2 id="citas">Sus citas</h2>
          <p className={e.explica}>Te recordamos un día antes y, después de la cita, le preguntamos cómo le fue para contarte.</p>
          {proximas.length === 0 && <p className={e.vacio}>No hay citas próximas.</p>}
          <ul className={e.lista}>
            {proximas.map((c) => (
              <li key={c.id} className={e.cita}>
                <div>
                  <p className={e.nombre}>{c.conQuien}</p>
                  <p className={e.detalle}>{cuandoEs(c.fecha, hoy) === "hoy" || cuandoEs(c.fecha, hoy) === "mañana" ? `${cuandoEs(c.fecha, hoy).replace(/^./, (x) => x.toUpperCase())} (${fechaLarga(c.fecha)})` : fechaLarga(c.fecha).replace(/^./, (x) => x.toUpperCase())}{c.hora && `, ${c.hora}`}{c.lugar && ` · ${c.lugar}`}</p>
                </div>
                <form action={quitarCita}>{oculto}<input type="hidden" name="id" value={c.id} /><button className={e.quitar} type="submit">Quitar</button></form>
              </li>
            ))}
          </ul>
          <details className={e.agregar}>
            <summary>Agregar una cita</summary>
            <form action={agregarCita} className={e.formGrid}>
              {oculto}
              <label>Con quién<input type="text" name="conQuien" required placeholder="Cardiólogo, Dr. Ramírez" /></label>
              <label>Fecha<input type="date" name="fecha" required min={hoy} /></label>
              <label>Hora<input type="time" name="hora" /></label>
              <label>Dónde<input type="text" name="lugar" placeholder="Clínica 1 del IMSS" /></label>
              <button className="boton boton-principal boton-chico" type="submit">Agregar cita</button>
            </form>
          </details>
          {pasadas.length > 0 && (
            <>
              <h3 className={e.subtitulo}>Lo que contó de sus citas</h3>
              <ul className={e.lista}>
                {pasadas.map((c) => (
                  <li key={c.id} className={e.citaPasada}>
                    <p className={e.nombre}>{c.conQuien} <span className={e.detalle}>· {fechaLarga(c.fecha)}</span></p>
                    <p>{c.loQueConto ? `“${c.loQueConto}”` : "Todavía no nos ha contado."}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className={e.bloque} aria-labelledby="historias">
          <h2 id="historias">Sus historias</h2>
          <p className={e.explica}>De vez en cuando le preguntamos por su vida. Cuando ella está de acuerdo, guardamos la historia con su voz para la familia.</p>
          {suHistoria.length === 0 && <p className={e.vacio}>Aquí van a aparecer sus historias, contadas por ella.</p>}
          {suHistoria.map((h) => (
            <article key={h.id} className={e.historia}>
              <h3>{h.titulo}</h3>
              <p className={e.detalle}>{h.creadaEn.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}</p>
              {h.audios.map((_, i) => (
                <audio key={i} controls preload="none" src={`/mama/${token}/audio/${h.id}/${i}`} className={e.audio}>
                  Tu navegador no puede reproducir este audio.
                </audio>
              ))}
              <p className={e.texto}>{h.texto}</p>
            </article>
          ))}
        </section>

        <footer className={e.pie}>
          <p>¿Algo no está bien o quieres cambiar algo? <a href={enlaceWhatsApp(`Hola, soy ${familia.nombreContacto}, de la familia de ${adulto.comoLlamarle}.`)}>Escríbenos por WhatsApp</a>.</p>
        </footer>
      </div>
    </main>
  );
}
