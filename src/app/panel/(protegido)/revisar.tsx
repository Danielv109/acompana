"use client";

import { useActionState } from "react";
import { aprobarResumen, type EstadoAccion } from "../acciones";
import estilos from "../panel.module.css";

export function RevisarResumen({ id, borrador }: { id: string; borrador: string }) {
  const [estado, accion, enviando] = useActionState<EstadoAccion, FormData>(aprobarResumen, {});
  return (
    <form action={accion}>
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`texto-${id}`}>Resumen para la familia <span className="ayuda">Corrígelo si algo no está bien. Se envía tal cual.</span></label>
      <textarea id={`texto-${id}`} name="texto" defaultValue={borrador} rows={7} />
      <div className={estilos.acciones}>
        <button className="boton boton-principal" type="submit" disabled={enviando || Boolean(estado.ok)}>
          {enviando ? "Enviando…" : estado.ok ? "Enviado" : "Aprobar y enviar"}
        </button>
        {estado.ok && <span className={estilos.mensajeOk} role="status">{estado.ok}</span>}
        {estado.error && <span className={estilos.mensajeError} role="alert">{estado.error}</span>}
      </div>
    </form>
  );
}
