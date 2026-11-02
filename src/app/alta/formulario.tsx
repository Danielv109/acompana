"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { registrar, type EstadoRegistro } from "./acciones";
import e from "./alta.module.css";

type CampoProps = {
  nombre: string; etiqueta: string; ayuda?: string; tipo?: string; requerido?: boolean;
  estado: EstadoRegistro; placeholder?: string; autoComplete?: string; porDefecto?: string;
};

function Campo({ nombre, etiqueta, ayuda, tipo = "text", requerido, estado, placeholder, autoComplete, porDefecto }: CampoProps) {
  const error = estado.errores?.[nombre];
  return (
    <div className="campo">
      <label htmlFor={nombre}>
        {etiqueta}{!requerido && <span className={e.opcional}> (opcional)</span>}
        {ayuda && <span className="ayuda">{ayuda}</span>}
      </label>
      <input
        id={nombre} name={nombre} type={tipo} required={requerido} placeholder={placeholder} autoComplete={autoComplete}
        defaultValue={estado.valores?.[nombre] ?? porDefecto} aria-invalid={Boolean(error)} aria-describedby={error ? `${nombre}-error` : undefined}
        className={error ? e.conError : undefined}
      />
      {error && <p id={`${nombre}-error`} className={e.error}>{error}</p>}
    </div>
  );
}

function Casilla({ nombre, children, estado }: { nombre: string; children: React.ReactNode; estado: EstadoRegistro }) {
  const error = estado.errores?.[nombre];
  return (
    <>
      <label className="casilla">
        <input type="checkbox" name={nombre} value="si" required defaultChecked={estado.valores?.[nombre] === "si"} />
        <span>{children}</span>
      </label>
      {error && <p className={e.error}>{error}</p>}
    </>
  );
}

export function FormularioAlta() {
  const [estado, accion, enviando] = useActionState<EstadoRegistro, FormData>(registrar, {});
  const v = (k: string, porDefecto: string) => estado.valores?.[k] ?? porDefecto;
  const formulario = useRef<HTMLFormElement>(null);

  // Si hay errores, lleva a la persona al primer campo que debe corregir
  useEffect(() => {
    if (!estado.errores) return;
    const primero = formulario.current?.querySelector<HTMLElement>("[aria-invalid='true'], input[type=checkbox]:not(:checked)");
    primero?.focus();
    primero?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [estado]);

  return (
    <form ref={formulario} action={accion} noValidate className={e.formulario}>
      {estado.general && <div role="alert" className={e.aviso}>{estado.general}</div>}
      {/* Campo trampa: las personas no lo ven; los bots lo llenan */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="sitioWeb">Sitio web</label>
        <input id="sitioWeb" name="sitioWeb" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <fieldset className={e.bloque}>
        <legend>Tus datos</legend>
        <p className={e.explica}>Aquí te llegan los resúmenes y los avisos.</p>
        <div className={e.dos}>
          <Campo nombre="tuNombre" etiqueta="Tu nombre" requerido estado={estado} autoComplete="name" />
          <Campo nombre="tuRelacion" etiqueta="¿Qué eres de ella?" placeholder="Hijo, hija, nieta…" requerido estado={estado} />
        </div>
        <div className={e.dos}>
          <Campo nombre="tuTelefono" etiqueta="Tu WhatsApp" tipo="tel" ayuda="10 dígitos si es de México; con +1 si es de Estados Unidos." requerido estado={estado} autoComplete="tel" />
          <Campo nombre="tuCorreo" etiqueta="Tu correo" tipo="email" ayuda="Para tus recibos." requerido estado={estado} autoComplete="email" />
        </div>
        <div className="campo">
          <label htmlFor="moneda">¿Desde dónde pagas?</label>
          <select id="moneda" name="moneda" defaultValue={v("moneda", "mxn")}>
            <option value="mxn">Desde México, en pesos</option>
            <option value="usd">Desde Estados Unidos, en dólares</option>
          </select>
        </div>
      </fieldset>

      <fieldset className={e.bloque}>
        <legend>Sobre ella</legend>
        <p className={e.explica}>Mientras más nos cuentes, más natural será la plática desde el primer día.</p>
        <div className={e.dos}>
          <Campo nombre="suNombre" etiqueta="Su nombre completo" requerido estado={estado} />
          <Campo nombre="comoLlamarle" etiqueta="¿Cómo le gusta que le digan?" placeholder="Doña Rosa, Rosita, Don Beto…" requerido estado={estado} />
        </div>
        <div className={e.dos}>
          <Campo nombre="suTelefono" etiqueta="Su WhatsApp" tipo="tel" ayuda="El celular donde contesta. Sus 10 dígitos." requerido estado={estado} />
          <Campo nombre="horaSaludo" etiqueta="¿A qué hora la saludamos?" tipo="time" ayuda="Hora de México. Mejor cuando ya desayunó o está tranquila." requerido estado={estado} porDefecto="09:00" />
        </div>
        <div className="campo">
          <label htmlFor="canal">¿Cómo prefiere contestar?</label>
          <select id="canal" name="canal" defaultValue={v("canal", "voz")}>
            <option value="voz">Con notas de voz (recomendado: no tiene que leer)</option>
            <option value="texto">Con mensajes escritos (si escucha poco)</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="sobreElla">
            Cuéntanos de ella<span className={e.opcional}> (opcional, pero ayuda mucho)</span>
            <span className="ayuda">Qué le gusta, con quién vive, nombres de nietos y comadres, temas que la alegran y temas que mejor evitar.</span>
          </label>
          <textarea id="sobreElla" name="sobreElla" defaultValue={v("sobreElla", "")} placeholder="Tiene 78 años, vive sola desde que murió mi papá. Ama su jardín y la novela de las 8. Su nieta Sofía estudia enfermería. Mejor no hablarle de política." />
        </div>
        <p className={e.subtitulo}>Sus medicinas <span className={e.opcional}>(opcional)</span></p>
        <p className={e.explica}>Para recordárselas con cariño. Nunca le diremos que cambie una dosis.</p>
        <div className={e.medicinas}>
          <Campo nombre="medicina1" etiqueta="Medicina 1" placeholder="Losartán 50 mg en la mañana" estado={estado} />
          <Campo nombre="medicina2" etiqueta="Medicina 2" placeholder="Metformina en la comida" estado={estado} />
          <Campo nombre="medicina3" etiqueta="Medicina 3" estado={estado} />
        </div>
      </fieldset>

      <fieldset className={e.bloque}>
        <legend>Ficha de emergencia</legend>
        <p className={e.explica}>Ojalá nunca la usemos. Si hace falta, es lo que se le dicta al 911 o a los paramédicos.</p>
        <Campo nombre="direccion" etiqueta="Dirección completa" placeholder="Calle, número, colonia, ciudad" requerido estado={estado} autoComplete="street-address" />
        <Campo nombre="referencias" etiqueta="Referencias para llegar" placeholder="Casa verde con portón negro, frente a la tienda" estado={estado} />
        <div className={e.dos}>
          <Campo nombre="enfermedades" etiqueta="Enfermedades" placeholder="Hipertensión, diabetes…" estado={estado} />
          <Campo nombre="alergias" etiqueta="Alergias" placeholder="Penicilina…" estado={estado} />
        </div>
        <div className={e.tres}>
          <Campo nombre="tipoSangre" etiqueta="Tipo de sangre" placeholder="O+" estado={estado} />
          <Campo nombre="seguro" etiqueta="Seguro médico" placeholder="IMSS, ISSSTE, privado…" estado={estado} />
          <Campo nombre="hospitalCercano" etiqueta="Hospital más cercano" estado={estado} />
        </div>
      </fieldset>

      <fieldset className={e.bloque}>
        <legend>Alguien que viva cerca</legend>
        <p className={e.explica}>Una vecina, un familiar o un amigo que pueda ir a verla si algo pasa. Solo le escribimos en una alerta.</p>
        <div className={e.tres}>
          <Campo nombre="cercanoNombre" etiqueta="Nombre" requerido estado={estado} />
          <Campo nombre="cercanoRelacion" etiqueta="¿Qué es de ella?" placeholder="Vecina, sobrino…" requerido estado={estado} />
          <Campo nombre="cercanoTelefono" etiqueta="Su WhatsApp" tipo="tel" requerido estado={estado} />
        </div>
        <div className="campo">
          <label htmlFor="cercanoTieneLlave">¿Tiene llave de su casa?</label>
          <select id="cercanoTieneLlave" name="cercanoTieneLlave" defaultValue={v("cercanoTieneLlave", "no")}>
            <option value="no">No</option>
            <option value="si">Sí</option>
          </select>
        </div>
        <p className={e.subtitulo}>¿Alguien más quiere recibir los resúmenes? <span className={e.opcional}>(opcional)</span></p>
        <div className={e.dos}>
          <Campo nombre="otroNombre" etiqueta="Nombre" placeholder="Tu hermana, por ejemplo" estado={estado} />
          <Campo nombre="otroTelefono" etiqueta="Su WhatsApp" tipo="tel" estado={estado} />
        </div>
      </fieldset>

      <fieldset className={e.bloque}>
        <legend>Antes de empezar</legend>
        <Casilla nombre="ellaSabe" estado={estado}>
          Ella sabe de Acompaña y está de acuerdo. En la videollamada de bienvenida le pediremos su consentimiento por escrito; sin él no empezamos.
        </Casilla>
        <Casilla nombre="entiendeEmergencias" estado={estado}>
          Entiendo que Acompaña no es un servicio de emergencias ni sustituye al médico.
        </Casilla>
        <Casilla nombre="aceptaPrivacidad" estado={estado}>
          Acepto el <Link href="/privacidad" target="_blank">aviso de privacidad</Link> y los <Link href="/terminos" target="_blank">términos del servicio</Link>.
        </Casilla>
      </fieldset>

      <div className={e.enviar}>
        <button type="submit" className="boton boton-principal" disabled={enviando}>
          {enviando ? "Guardando…" : "Empezar mis 14 días gratis"}
        </button>
        <p className={e.explica}>No se te cobra nada hoy. Si decides seguir, el cobro empieza el día 15.</p>
      </div>
    </form>
  );
}
