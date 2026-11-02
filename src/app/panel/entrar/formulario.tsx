"use client";

import { useActionState } from "react";
import { entrar, type EstadoAccion } from "../acciones";

export function FormularioEntrar() {
  const [estado, accion, enviando] = useActionState<EstadoAccion, FormData>(entrar, {});
  return (
    <form action={accion}>
      <div className="campo">
        <label htmlFor="nombre">Tu nombre</label>
        <input id="nombre" name="nombre" type="text" autoComplete="name" required defaultValue={estado.nombre} key={estado.nombre} />
      </div>
      <div className="campo">
        <label htmlFor="contrasena">Contraseña</label>
        <input id="contrasena" name="contrasena" type="password" autoComplete="current-password" required />
      </div>
      {estado.error && <p role="alert" style={{ color: "var(--rojo)", fontWeight: 700 }}>{estado.error}</p>}
      <button className="boton boton-principal" type="submit" disabled={enviando} style={{ width: "100%" }}>
        {enviando ? "Entrando…" : "Entrar al panel"}
      </button>
    </form>
  );
}
