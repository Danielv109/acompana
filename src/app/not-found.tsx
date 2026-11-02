import Link from "next/link";

export default function NoEncontrada() {
  return (
    <main className="contenedor" style={{ maxWidth: 640, margin: "14vh auto" }}>
      <h1>Esta página no existe</h1>
      <p>Puede que el enlace esté incompleto. Desde el inicio encuentras todo.</p>
      <Link className="boton boton-principal" href="/">Ir al inicio</Link>
    </main>
  );
}
