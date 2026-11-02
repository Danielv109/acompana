import type { Metadata } from "next";
import Link from "next/link";
import { marca } from "@/lib/marca";
import e from "../legal.module.css";

export const metadata: Metadata = { title: "Aviso de privacidad · Acompaña" };

export default function Privacidad() {
  return (
    <main className={`contenedor ${e.pagina}`}>
      <Link href="/" className={e.volver}>Volver al inicio</Link>
      <article className={e.texto}>
        <h1>Aviso de privacidad integral</h1>
        <p className={e.borrador}>Versión preliminar. Este aviso está en revisión legal y puede cambiar antes del lanzamiento.</p>

        <h2>Quién es responsable de tus datos</h2>
        <p>{marca.nombre}, con domicilio en {marca.ciudad}, México [completar domicilio y nombre del responsable], es responsable del tratamiento de los datos personales que nos proporcionas, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares. Contacto: <a href={`mailto:${marca.correo}`}>{marca.correo}</a>.</p>

        <h2>Qué datos tratamos</h2>
        <ul>
          <li><b>De la familia que contrata:</b> nombre, parentesco, WhatsApp, correo y datos de pago (los procesa Stripe; nosotros no guardamos los números de tu tarjeta).</li>
          <li><b>De la persona acompañada:</b> nombre, cómo le gusta que le digan, WhatsApp, dirección, gustos e información que la familia comparta.</li>
          <li><b>Datos sensibles de la persona acompañada:</b> enfermedades, alergias, medicinas, tipo de sangre, estado de ánimo y lo que comparta sobre su salud en las pláticas, incluida la transcripción de sus notas de voz, y las historias de su vida que ella acepte guardar con su voz.</li>
          <li><b>De los contactos de emergencia:</b> nombre, parentesco y WhatsApp.</li>
        </ul>

        <h2>Para qué los usamos</h2>
        <p>Finalidades necesarias para el servicio:</p>
        <ul>
          <li>Platicar todos los días con la persona acompañada y recordarle sus medicinas.</li>
          <li>Enviar resúmenes diarios, recordatorios de medicinas y citas, y avisos a los familiares autorizados.</li>
          <li>Mantener la página privada de la familia con sus medicinas, citas, lo que contó de sus consultas e historias.</li>
          <li>Avisar a los contactos registrados cuando haya una posible emergencia y facilitar la ficha de emergencia al 911 o a los paramédicos.</li>
          <li>Cobrar el servicio y atender dudas y aclaraciones.</li>
        </ul>
        <p>Finalidades adicionales, que puedes rechazar sin afectar el servicio: mejorar las instrucciones de nuestro asistente revisando pláticas anónimas, y enviarte novedades del servicio.</p>

        <h2>Consentimiento</h2>
        <p>Para tratar los datos sensibles de la persona acompañada pedimos su consentimiento expreso y por escrito, mediante firma autógrafa, firma electrónica o un mecanismo de autenticación, antes de iniciar el servicio. Sin ese consentimiento no la contactamos.</p>

        <h2>Con quién los compartimos</h2>
        <p>Solo con los familiares y contactos que la familia autoriza, y con proveedores que nos ayudan a dar el servicio bajo contrato y confidencialidad: mensajería de WhatsApp (Meta), inteligencia artificial para conversar y resumir, conversión de voz a texto, almacenamiento en la nube y procesamiento de pagos. Ninguno puede usarlos para fines propios. No vendemos datos personales.</p>

        <h2>Cuánto tiempo los guardamos</h2>
        <p>Sus notas de voz se borran a los 30 días. La excepción son las historias de su vida que ella acepta guardar con su voz: le pedimos permiso cada vez, y se conservan en la página privada de su familia mientras el servicio esté activo o hasta que ella o su familia pidan borrarlas. Conservamos las transcripciones y resúmenes mientras el servicio esté activo y hasta 12 meses después, salvo que pidas antes su eliminación o la ley exija otra cosa.</p>

        <h2>Tus derechos</h2>
        <p>Tú o la persona acompañada pueden acceder a sus datos, corregirlos, pedir que los eliminemos u oponerse a su uso, así como revocar su consentimiento, escribiendo a <a href={`mailto:${marca.correo}`}>{marca.correo}</a> con su nombre, lo que solicita y un medio para responderle. Responderemos en los plazos que marca la ley.</p>

        <h2>Cambios a este aviso</h2>
        <p>Publicaremos cualquier cambio en esta página y, si es importante, te avisaremos por WhatsApp o correo.</p>
      </article>
    </main>
  );
}
