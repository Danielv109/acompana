import Link from "next/link";
import { enlaceWhatsApp, marca } from "@/lib/marca";
import e from "./inicio.module.css";

const dia = [
  { hora: "9:00", texto: "Le mandamos un saludo por WhatsApp. Ella contesta con una nota de voz, como si platicara con alguien de confianza." },
  { hora: "9:05", texto: "Platican unos minutos: cómo durmió, si ya tomó su pastilla, qué va a hacer hoy. La voz se acuerda de lo que le contó ayer." },
  { hora: "10:00", texto: "Una persona de nuestro equipo lee la plática, revisa el resumen y te llega a tu WhatsApp." },
  { hora: "Si algo preocupa", texto: "Si menciona una caída, un dolor fuerte o una llamada rara del “banco”, te avisamos en ese momento, sin esperar al resumen." },
];

const preguntas = [
  {
    p: "¿Mi mamá necesita un celular especial o saber mucho de tecnología?",
    r: "No. Necesita WhatsApp en su celular y poder mandar una nota de voz o escribir un mensaje corto. En la videollamada de bienvenida le dejamos el teléfono listo y practicamos una vez juntos. Si escucha poco, le escribimos con mensajes cortos en lugar de audios.",
  },
  {
    p: "¿Platica con una persona o con una inteligencia artificial?",
    r: "La plática la hace un asistente con inteligencia artificial, preparado para hablar con calma, cariño y paciencia. Una persona de nuestro equipo lee cada plática y revisa cada resumen antes de mandártelo. Si tu mamá pregunta con quién habla, siempre le decimos la verdad.",
  },
  {
    p: "¿Qué pasa si no contesta?",
    r: "Le volvemos a escribir a las 2 horas y otra vez a las 4. Si no contesta en todo el día, te avisamos para que le llames o le pidas a alguien cercano que pase a verla. Muchas veces es algo simple, como el teléfono sin batería.",
  },
  {
    p: "¿Qué pasa en una emergencia?",
    r: "Acompaña no es un servicio de emergencias. Si tu mamá menciona una emergencia, le pedimos que llame al 911 o a alguien cercano, te avisamos a ti y a tus contactos al instante, y una persona de nuestro equipo te ayuda a coordinar. Por eso te pedimos el contacto de alguien que viva cerca de ella.",
  },
  {
    p: "¿Quién ve lo que platica?",
    r: "Solo nuestro equipo y los familiares que tú autorices. Tratamos su información de salud como datos sensibles, como pide la ley, y ella da su consentimiento por escrito antes de empezar. Nunca vendemos ni compartimos sus datos.",
  },
  {
    p: "¿Y si a mi mamá no le gusta?",
    r: "Empezamos con una videollamada contigo y con ella, para que nos conozca y escuche la voz. Si en los 14 días de prueba no le gusta, cancelas y no se te cobra nada.",
  },
  {
    p: "¿Cómo pago y cómo cancelo?",
    r: "Con tarjeta, en pesos o en dólares si vives en Estados Unidos. Los primeros 14 días son gratis y el cobro empieza el día 15, cada mes. Cancelas cuando quieras escribiéndonos por WhatsApp, sin penalización ni preguntas incómodas.",
  },
];

function precio(n: number) {
  return n.toLocaleString("es-MX");
}

export default function Inicio() {
  return (
    <>
      <a href="#contenido" className="visualmente-oculto">Saltar al contenido</a>

      <header className={e.cabecera}>
        <div className={`contenedor ${e.cabeceraInterior}`}>
          <Link href="/" className={e.marca}>
            <span className={e.marcaPunto} aria-hidden="true" />
            {marca.nombre}
          </Link>
          <nav className={e.nav} aria-label="Principal">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#precio">Precio</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <Link href="/alta" className={`boton boton-principal boton-chico ${e.navBoton}`}>Probar gratis</Link>
        </div>
      </header>

      <main id="contenido">
        <section className={e.portada}>
          <div className={`contenedor ${e.portadaInterior}`}>
            <div className={e.portadaTexto}>
              <h1>Cada mañana platicamos con tu mamá. Cada mañana te contamos cómo está.</h1>
              <p className={e.entrada}>
                Le escribimos por WhatsApp para saber cómo amaneció, recordarle su medicina y hacerle compañía un rato.
                Tú recibes un resumen y un aviso si algo anda mal, estés en otra ciudad o en otro país.
              </p>
              <div className={e.botones}>
                <Link href="/alta" className="boton boton-principal">Probar {marca.diasDePrueba} días gratis</Link>
                <a href={enlaceWhatsApp()} className="boton boton-secundario" target="_blank" rel="noreferrer">Preguntar por WhatsApp</a>
              </div>
              <p className={e.nota}>Ella no instala nada. Tú cancelas cuando quieras.</p>
            </div>

            <figure className={e.mensaje} aria-label="Ejemplo del resumen que recibes cada día">
              <div className={e.mensajeCabeza}>
                <span className={e.avatar} aria-hidden="true">A</span>
                <div>
                  <b>{marca.nombre}</b>
                  <span className={e.hora}>Hoy, 10:02</span>
                </div>
              </div>
              <div className={e.burbuja}>
                <p className={e.burbujaTitulo}>Doña Rosa amaneció contenta</p>
                <p>
                  Ya regó sus plantas y se tomó el Losartán con el café. Contó que hoy viene su comadre Chela a comer
                  y que la rodilla le molesta menos que ayer. Si puedes, pregúntale por la receta del mole que quiere
                  enseñarle a Sofía.
                </p>
                <ul className={e.chips}>
                  <li>Tomó su medicina</li>
                  <li>Desayunó</li>
                  <li>De buen ánimo</li>
                </ul>
                <p className={e.firma}>Revisado por {marca.fundador}, de {marca.nombre}</p>
              </div>
              <figcaption className={e.pie}>Así se ve el resumen que te llega cada día.</figcaption>
            </figure>
          </div>
        </section>

        <section id="como-funciona" className={e.seccion}>
          <div className="contenedor">
            <h2>Así es un día con {marca.nombre}</h2>
            <ol className={e.dia}>
              {dia.map((d) => (
                <li key={d.hora}>
                  <span className={e.diaHora}>{d.hora}</span>
                  <p>{d.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={`${e.seccion} ${e.seccionClara}`}>
          <div className={`contenedor ${e.dosColumnas}`}>
            <div>
              <h2>Para ella, compañía</h2>
              <ul className={e.lista}>
                <li>Una voz amable que la llama por su nombre y se acuerda de lo que le contó ayer.</li>
                <li>El recordatorio de su medicina, dicho con cariño y sin regaños.</li>
                <li>No tiene que aprender nada nuevo: solo contestar como contesta a sus hijos.</li>
                <li>Si un día no quiere platicar, se respeta. Mañana le volvemos a escribir.</li>
              </ul>
            </div>
            <div>
              <h2>Para ti, tranquilidad</h2>
              <ul className={e.lista}>
                <li>Un resumen diario con algo concreto de su día, no un “todo bien” vacío.</li>
                <li>Aviso inmediato si menciona una caída, un dolor fuerte o algo raro con su banco.</li>
                <li>Aviso si no contestó en todo el día, para que le llames.</li>
                <li>Mándale un recado por WhatsApp y se lo decimos en su plática, con tus palabras.</li>
                <li>Tus hermanos también pueden recibir los resúmenes, para que no todo dependa de ti.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className={e.seccion}>
          <div className="contenedor">
            <h2>Lo que sí hacemos y lo que no</h2>
            <div className={e.honestidadGrid}>
              <div>
                <h3>No somos un servicio de emergencias</h3>
                <p>Tampoco sustituimos al médico. Si tu mamá menciona una emergencia, le pedimos que llame al 911 o a alguien cercano, te avisamos al instante y te ayudamos a coordinar.</p>
              </div>
              <div>
                <h3>Nunca le pedimos dinero ni datos de su banco</h3>
                <p>Ni a ella ni a ti por teléfono. Si alguien le llama diciendo que es de {marca.nombre} y le pide eso, es un fraude.</p>
              </div>
              <div>
                <h3>Una persona revisa todo</h3>
                <p>Ningún resumen te llega sin que alguien de nuestro equipo lo haya leído. La tecnología nos ayuda; las decisiones las toma una persona.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="precio" className={`${e.seccion} ${e.seccionClara}`}>
          <div className={`contenedor ${e.precio}`}>
            <div>
              <h2>Un precio claro</h2>
              <p>Los primeros {marca.diasDePrueba} días son gratis. Después pagas cada mes y cancelas cuando quieras.</p>
              <ul className={e.comparacion}>
                <li><b>Menos de ${Math.ceil(marca.precios.basico.mxn / 30)} pesos al día.</b> Menos que un café.</li>
                <li><b>Una cuidadora a domicilio en la Ciudad de México cobra en promedio $2,385 por día.</b> {marca.nombre} no la reemplaza, pero acompaña los días en que nadie puede ir.</li>
              </ul>
              <p className={e.fuente}>Promedio de cuidado a domicilio en CDMX según Cronoshare, 2026.</p>
            </div>
            <div className={e.plan}>
              <p className={e.planNombre}>Acompañamiento diario</p>
              <p className={e.planPrecio}>
                <span className={e.planCifra}>${precio(marca.precios.basico.mxn)}</span> pesos al mes
              </p>
              <p className={e.planUsd}>o ${marca.precios.basico.usd} dólares al mes si pagas desde Estados Unidos</p>
              <ul className={e.planIncluye}>
                <li>Saludo y plática todas las mañanas</li>
                <li>Resumen diario revisado por una persona</li>
                <li>Avisos inmediatos si algo preocupa</li>
                <li>Aviso si no contestó en el día</li>
                <li>Ficha de emergencia lista para el 911</li>
                <li>Hasta 4 familiares reciben los resúmenes</li>
              </ul>
              <Link href="/alta" className="boton boton-principal" style={{ width: "100%" }}>Probar {marca.diasDePrueba} días gratis</Link>
              <p className={e.fundador}>
                Precio de fundador: las primeras {marca.precioFundador.lugares} familias pagan ${marca.precioFundador.mxn} pesos al mes mientras sigan con nosotros.
              </p>
            </div>
          </div>
        </section>

        <section className={e.seccion}>
          <div className={`contenedor ${e.persona}`}>
            <div className={e.retrato} aria-hidden="true">{marca.fundador.charAt(0)}</div>
            <div>
              <h2>Quién está del otro lado</h2>
              {marca.historia.map((p) => <p key={p.slice(0, 20)}>{p}</p>)}
              <a href={enlaceWhatsApp(`Hola ${marca.fundador}, tengo una pregunta sobre Acompaña.`)} target="_blank" rel="noreferrer">Escribirle a {marca.fundador} por WhatsApp</a>
            </div>
          </div>
        </section>

        <section id="preguntas" className={`${e.seccion} ${e.seccionClara}`}>
          <div className={`contenedor ${e.preguntas}`}>
            <h2>Preguntas frecuentes</h2>
            {preguntas.map((q) => (
              <details key={q.p} className={e.pregunta}>
                <summary>{q.p}</summary>
                <p>{q.r}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={e.final}>
          <div className="contenedor">
            <h2>Que mañana ya sepas cómo amaneció</h2>
            <p>Llena el registro en 5 minutos. Te contactamos para la videollamada de bienvenida y el primer saludo llega a la mañana siguiente.</p>
            <div className={e.botones}>
              <Link href="/alta" className={`boton ${e.botonClaro}`}>Probar {marca.diasDePrueba} días gratis</Link>
              <a href={enlaceWhatsApp()} className={`boton ${e.botonContorno}`} target="_blank" rel="noreferrer">Preguntar por WhatsApp</a>
            </div>
          </div>
        </section>
      </main>

      <footer className={e.pieDePagina}>
        <div className={`contenedor ${e.pieInterior}`}>
          <span>© {new Date().getFullYear()} {marca.nombre}, {marca.ciudad}, México</span>
          <nav aria-label="Legal">
            <Link href="/privacidad">Aviso de privacidad</Link>
            <Link href="/terminos">Términos del servicio</Link>
            <a href={`mailto:${marca.correo}`}>{marca.correo}</a>
          </nav>
        </div>
      </footer>
    </>
  );
}
