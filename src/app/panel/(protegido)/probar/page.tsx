import Link from "next/link";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adultos, bandeja, contactos, familias } from "@/lib/db/schema";
import { asegurarToken } from "@/lib/ficha";
import { env } from "@/lib/env";
import { crearFamiliaPrueba, empezarDeCero, escribirComo, mandarRecordatorios, mandarSaludo, terminarPlatica } from "./acciones";
import e from "./probar.module.css";

export const dynamic = "force-dynamic";

type Fila = typeof bandeja.$inferSelect;

/** Convierte los enlaces del texto en links que se pueden abrir. */
function ConEnlaces({ texto }: { texto: string }) {
  const partes = texto.split(/(https?:\/\/\S+)/g);
  return <>{partes.map((p, i) => (/^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noreferrer">{p}</a> : p))}</>;
}

function Celular({ titulo, subtitulo, telefono, filas, adultoId, sugerencias, ayuda }: {
  titulo: string; subtitulo: string; telefono: string; filas: Fila[]; adultoId: string; sugerencias: string[]; ayuda: string;
}) {
  return (
    <section className={e.celular} aria-label={`Celular de ${titulo}`}>
      <header className={e.celularCabeza}>
        <p className={e.celularNombre}>{titulo}</p>
        <p className={e.celularSub}>{subtitulo}</p>
      </header>
      {/* column-reverse: el chat arranca abajo, en lo más nuevo, como WhatsApp */}
      <div className={e.chat}>
        <div className={e.chatInterior}>
        {filas.length === 0 && <p className={e.chatVacio}>{ayuda}</p>}
        {filas.map((m) => (
          <div key={m.id} className={m.direccion === "entra" ? e.burbujaPropia : e.burbuja}>
            {m.tipo === "plantilla" && <span className={e.etiqueta}>Plantilla</span>}
            {m.tipo === "audio" && <span className={e.etiqueta}>Nota de voz</span>}
            <p><ConEnlaces texto={m.texto} /></p>
            <time>{m.creadoEn.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" })}</time>
          </div>
        ))}
        </div>
      </div>
      <form action={escribirComo} className={e.escribir}>
        <input type="hidden" name="adulto" value={adultoId} />
        <input type="hidden" name="telefono" value={telefono} />
        <label className={e.oculto} htmlFor={`texto-${telefono}`}>Mensaje como {titulo}</label>
        <textarea id={`texto-${telefono}`} name="texto" rows={2} required placeholder={`Escribe como ${titulo}…`} />
        <button className="boton boton-principal boton-chico" type="submit">Enviar</button>
      </form>
      {sugerencias.length > 0 && (
        <div className={e.sugerencias}>
          {sugerencias.map((s) => (
            <form key={s} action={escribirComo}>
              <input type="hidden" name="adulto" value={adultoId} />
              <input type="hidden" name="telefono" value={telefono} />
              <input type="hidden" name="texto" value={s} />
              <button type="submit" className={e.sugerencia}>{s}</button>
            </form>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function Probar({ searchParams }: { searchParams: Promise<{ adulto?: string; aviso?: string }> }) {
  const { adulto: adultoId, aviso } = await searchParams;

  if (!env.modoPrueba) {
    return (
      <div className={e.apagado}>
        <h1>Modo prueba apagado</h1>
        <p>Para probar Acompaña sin WhatsApp, arráncalo con <code>npm run probar</code> (o pon <code>MODO_PRUEBA=si</code> en tu <code>.env</code>).</p>
        <p>Nunca lo actives en el servidor real: los mensajes no saldrían a WhatsApp.</p>
      </div>
    );
  }

  const db = getDb();
  const todos = await db.select().from(adultos).orderBy(desc(adultos.creadoEn));
  const adulto = todos.find((a) => a.id === adultoId) ?? todos[0];

  if (!adulto) {
    return (
      <div className={e.inicio}>
        <h1>Probar Acompaña</h1>
        <p>Aquí platicas como si fueras la mamá y ves lo que le llega al hijo, sin WhatsApp y sin gastar.</p>
        <form action={crearFamiliaPrueba}><button className="boton boton-principal" type="submit">Crear una familia de prueba</button></form>
      </div>
    );
  }

  const [familia] = await db.select().from(familias).where(eq(familias.id, adulto.familiaId));
  const cs = await db.select().from(contactos).where(eq(contactos.familiaId, adulto.familiaId)).orderBy(asc(contactos.orden));
  const hijo = cs.find((c) => c.recibeResumen) ?? cs[0];
  const otros = cs.filter((c) => c.id !== hijo?.id);
  const telefonos = [adulto.telefono, ...cs.map((c) => c.telefono), ...(env.adminWhatsapp ? [env.adminWhatsapp] : [])];
  const filas = await db.select().from(bandeja).where(inArray(bandeja.telefono, telefonos)).orderBy(asc(bandeja.creadoEn));
  const de = (tel: string) => filas.filter((f) => f.telefono === tel);
  const token = await asegurarToken(db, familia.id);
  const comun = { adulto: adulto.id };

  return (
    <div className={e.marco}>
      <div className={e.encabezado}>
        <div>
          <h1>Probar Acompaña</h1>
          <p className={e.explica}>
            Nada sale a WhatsApp: todo queda en estos celulares simulados.{" "}
            {env.iaDeEjemplo
              ? <b>La IA está en modo ejemplo (respuestas preparadas). Pon tu ANTHROPIC_API_KEY en .env para platicar con la IA de verdad.</b>
              : "La IA es la real (usa tu clave de Anthropic)."}
          </p>
        </div>
        {todos.length > 1 && (
          <form className={e.selector}>
            <label>Familia
              <select name="adulto" defaultValue={adulto.id}>
                {todos.map((a) => <option key={a.id} value={a.id}>{a.comoLlamarle} ({a.nombre})</option>)}
              </select>
            </label>
            <button className="boton boton-secundario boton-chico" type="submit">Ver</button>
          </form>
        )}
      </div>

      {aviso && <p className={e.aviso} role="status">{aviso}</p>}
      {!adulto.activo && <p className={e.aviso}>{adulto.comoLlamarle} está inactiva: registra su consentimiento en Familias para que pueda platicar.</p>}

      <div className={e.controles}>
        {[
          { accion: mandarSaludo, texto: "1. Mandar el saludo de hoy", principal: true },
          { accion: terminarPlatica, texto: "2. Terminar la plática y hacer el resumen" },
          { accion: mandarRecordatorios, texto: "Mandar recordatorios al hijo" },
        ].map((b) => (
          <form key={b.texto} action={b.accion}>
            <input type="hidden" name="adulto" value={comun.adulto} />
            <button className={`boton ${b.principal ? "boton-principal" : "boton-secundario"} boton-chico`} type="submit">{b.texto}</button>
          </form>
        ))}
        <Link className="boton boton-secundario boton-chico" href={`/mama/${token}`} target="_blank">Abrir la página de la familia</Link>
        <form action={empezarDeCero}>
          <input type="hidden" name="adulto" value={comun.adulto} />
          <button className={e.reiniciar} type="submit">Empezar de cero</button>
        </form>
        <form action={crearFamiliaPrueba}>
          <button className={e.reiniciar} type="submit">Crear otra familia de prueba</button>
        </form>
      </div>

      <div className={e.celulares}>
        <Celular
          titulo={adulto.comoLlamarle} subtitulo="La mamá" telefono={adulto.telefono} filas={de(adulto.telefono)} adultoId={adulto.id}
          ayuda="Aquí le llegan los mensajes de Acompaña. Empieza con «Mandar el saludo de hoy»."
          sugerencias={["Bien, gracias. Ya desayuné", "Me duele un poco la rodilla", "Me caí en el baño", "Ya me voy, hasta mañana"]}
        />
        {hijo && (
          <Celular
            titulo={hijo.nombre} subtitulo={`${hijo.relacion} · recibe resúmenes y alertas`} telefono={hijo.telefono} filas={de(hijo.telefono)} adultoId={adulto.id}
            ayuda="Aquí le llegan al hijo los resúmenes, alertas y recordatorios."
            sugerencias={["¿Cómo va mi mamá?", "Recado: que el domingo vamos a comer con los niños", "Solo lo importante", "Todos los días"]}
          />
        )}
      </div>

      {(otros.length > 0 || env.adminWhatsapp) && (
        <details className={e.mas}>
          <summary>Otros celulares (vecina y tú)</summary>
          <div className={e.celulares}>
            {otros.map((c) => (
              <Celular key={c.id} titulo={c.nombre} subtitulo={`${c.relacion} · solo alertas`} telefono={c.telefono} filas={de(c.telefono)} adultoId={adulto.id} sugerencias={[]} ayuda="Solo le llegan las alertas rojas." />
            ))}
            {env.adminWhatsapp && (
              <Celular titulo="Tú (equipo)" subtitulo="Avisos internos" telefono={env.adminWhatsapp} filas={de(env.adminWhatsapp)} adultoId={adulto.id} sugerencias={[]} ayuda="Aquí te llegan las alertas y las preguntas de las familias." />
            )}
          </div>
        </details>
      )}
    </div>
  );
}
