# Plantillas de WhatsApp

WhatsApp solo deja que **tú inicies** una conversación con plantillas aprobadas por Meta. Cuando la persona responde, se abre una ventana de 24 horas para platicar libremente (ahí van las notas de voz).

Crea estas 7 plantillas en **WhatsApp Manager → Plantillas de mensajes**, idioma **Español (MEX)** (`es_MX`), categoría **Utilidad**. Los nombres deben coincidir con los de tu `.env`.

Reglas de Meta que ya cuidamos: las variables (`{{1}}`, `{{2}}`…) no pueden ir al inicio ni al final del texto, y el valor de una variable no puede tener saltos de línea (la app los quita sola).

---

## 1. `saludo_diario` (al adulto mayor, cada mañana)

```
Hola, {{1}}, le saluda Acompaña. ¿Cómo está hoy? Puede contestarme con una nota de voz, como si platicáramos.
```
Ejemplo de variable para Meta: `{{1}}` = Doña Rosa. (No dice "buenos días" a propósito: sirve a cualquier hora que elija la familia.)

> Si cambias este texto, cambia también `textoSaludo()` en `src/lib/acompana.ts` para que la IA sepa qué se le dijo.

## 1b. `saludo_reintento` (si no contestó en 2 horas)

```
Hola otra vez. {{1}}, solo quería saber cómo está. Cuando pueda, mándeme una nota de voz o un mensaje corto.
```
Ejemplo: `{{1}}` = Doña Rosa

> El texto de `textoReintento()` en `src/lib/acompana.ts` debe decir lo mismo (empieza con "Hola otra vez." porque Meta no permite que una plantilla empiece con una variable).

## 2. `resumen_diario` (a la familia, después de que lo apruebas)

```
Resumen de {{1}} del {{2}}:

{{3}}

Todo lo de ella, en su página: https://acompana.mx/mama/{{4}} (solo para tu familia). Para mandarle un recado, responde empezando con la palabra Recado.
```
Ejemplo: `{{1}}` = Doña Rosa · `{{2}}` = lunes 3 de noviembre · `{{3}}` = Amaneció contenta y ya se tomó su pastilla. · `{{4}}` = Xy12ab34Cd56ef78Gh90ij12

> Cambia `https://acompana.mx` por tu dominio real (el mismo de `APP_URL`) antes de mandarla a aprobar.

## 3. `alerta_familia` (a la familia, solo en alerta roja)

```
Aviso importante sobre {{1}}: {{2}}. Lo que dijo: "{{3}}". Si es una emergencia, llama al 911 o pide a alguien cercano que vaya a verla. Nuestro equipo ya está intentando comunicarse con ella.
```
Ejemplo: `{{1}}` = Doña Rosa · `{{2}}` = Posible caída · `{{3}}` = Me caí en el baño

## 4. `aviso_interno` (a ti: alertas y familias nuevas)

```
Aviso de Acompaña: {{1}} (mensaje automático)
```
Ejemplo: `{{1}}` = ALERTA ROJA: Doña Rosa (Rosa Martínez). Posible caída.

## 5. `recordatorio_familia` (al hijo: medicinas, citas y cumpleaños)

```
Recordatorio sobre {{1}}: {{2}} Si quieres ver todo, pregunta "¿cómo va?" en este chat.
```
Ejemplo: `{{1}}` = Doña Rosa · `{{2}}` = al Losartán le quedan unos 5 días. ¿Ya tienes quién se lo surta? Cuando lo tenga, márcalo en su página.

## 6. `bienvenida_familia` (al registrarse)

```
Hola {{1}}, ya registramos a {{2}} en Acompaña. Esta es su página, donde puedes agregar sus medicinas y citas para que te recordemos a tiempo: https://acompana.mx/mama/{{3}} Te escribimos pronto para la videollamada de bienvenida.
```
Ejemplo: `{{1}}` = Juan · `{{2}}` = Doña Rosa · `{{3}}` = Xy12ab34Cd56ef78Gh90ij12
