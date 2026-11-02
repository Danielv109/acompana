# Plantillas de WhatsApp

WhatsApp solo deja que **tú inicies** una conversación con plantillas aprobadas por Meta. Cuando la persona responde, se abre una ventana de 24 horas para platicar libremente (ahí van las notas de voz).

Crea estas 4 plantillas en **WhatsApp Manager → Plantillas de mensajes**, idioma **Español (MEX)** (`es_MX`), categoría **Utilidad**. Los nombres deben coincidir con los de tu `.env`.

Reglas de Meta que ya cuidamos: las variables (`{{1}}`, `{{2}}`…) no pueden ir al inicio ni al final del texto, y el valor de una variable no puede tener saltos de línea (la app los quita sola).

---

## 1. `saludo_diario` (al adulto mayor, cada mañana)

```
Buenos días, {{1}}. Le saluda Acompaña. ¿Cómo amaneció hoy? Puede contestarme con una nota de voz, como si platicáramos.
```
Ejemplo de variable para Meta: `{{1}}` = Doña Rosa

> Si cambias este texto, cambia también `textoSaludo()` en `src/lib/acompana.ts` para que la IA sepa qué se le dijo.

## 2. `resumen_diario` (a la familia, después de que lo apruebas)

```
Resumen de {{1}} del {{2}}:

{{3}}

Revisado por el equipo de Acompaña. Si tienes una duda, responde a este mensaje.
```
Ejemplo: `{{1}}` = Doña Rosa · `{{2}}` = lunes 3 de noviembre · `{{3}}` = Amaneció contenta y ya se tomó su pastilla. Contó que hoy viene su comadre a comer.

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
