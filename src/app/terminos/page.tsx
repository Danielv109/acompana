import type { Metadata } from "next";
import Link from "next/link";
import { marca } from "@/lib/marca";
import e from "../legal.module.css";

export const metadata: Metadata = { title: "Términos del servicio · Acompaña" };

export default function Terminos() {
  return (
    <main className={`contenedor ${e.pagina}`}>
      <Link href="/" className={e.volver}>Volver al inicio</Link>
      <article className={e.texto}>
        <h1>Términos del servicio</h1>
        <p className={e.borrador}>Versión preliminar. Estos términos están en revisión legal y pueden cambiar antes del lanzamiento.</p>

        <h2>Qué es {marca.nombre}</h2>
        <p>Un servicio de acompañamiento por WhatsApp: un asistente con inteligencia artificial platica a diario con la persona acompañada y nuestro equipo envía a su familia un resumen revisado por una persona y avisos cuando algo preocupa.</p>

        <h2>Qué no es</h2>
        <ul>
          <li><b>No es un servicio de emergencias.</b> No garantizamos detectar todas las situaciones de riesgo ni tiempos de respuesta. Ante una emergencia, la persona o su familia deben llamar al 911.</li>
          <li><b>No es un servicio médico.</b> No damos diagnósticos, tratamientos ni indicaciones sobre medicinas. Los recordatorios se basan en lo que la familia nos informa.</li>
          <li><b>No sustituye el cuidado presencial.</b> La familia se compromete a registrar al menos un contacto que viva cerca y pueda acudir.</li>
        </ul>

        <h2>Qué hacemos ante una posible emergencia</h2>
        <p>Si la persona menciona una situación de riesgo, le pedimos que llame al 911 o a alguien cercano, avisamos de inmediato a los contactos registrados y una persona de nuestro equipo intenta comunicarse con ella y con la familia. Solo llamamos al 911 en nombre de la persona con autorización de la familia.</p>

        <h2>Prueba, pagos y cancelación</h2>
        <ul>
          <li>Los primeros {marca.diasDePrueba} días son gratis. Después, el servicio se cobra cada mes con la tarjeta registrada, al precio publicado al momento de contratar.</li>
          <li>Puedes cancelar en cualquier momento escribiéndonos; el servicio sigue hasta el final del periodo pagado. No hay penalizaciones.</li>
          <li>Si un pago falla, seguimos acompañando a la persona 7 días mientras se resuelve.</li>
        </ul>

        <h2>Responsabilidades de la familia</h2>
        <ul>
          <li>Que la persona acompañada sepa del servicio y dé su consentimiento.</li>
          <li>Dar información verdadera y avisarnos de cambios: teléfonos, medicinas, dirección, contactos.</li>
          <li>Mantener al menos un contacto cercano disponible.</li>
        </ul>

        <h2>Seguridad</h2>
        <p>{marca.nombre} nunca pide dinero, datos bancarios, contraseñas, NIP ni códigos a la persona acompañada ni a su familia por WhatsApp o teléfono.</p>

        <h2>Contacto</h2>
        <p><a href={`mailto:${marca.correo}`}>{marca.correo}</a></p>
      </article>
    </main>
  );
}
