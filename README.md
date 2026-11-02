# Acompaña

Compañía por WhatsApp para personas mayores, y todo lo de ella al día para su familia.

- **Para ella:** una voz amable con quien platicar a gusto a cualquier hora, que se acuerda de su gente, le da seguimiento a sus chismes y, si ella quiere, guarda sus historias con su voz.
- **Para el hijo:** la página privada de su mamá (medicinas, citas, lo que contó del doctor, historias), recordatorios antes de que se acabe una medicina y un día antes de cada cita, un aviso corto por WhatsApp con enlace a los detalles (cada día o solo cuando hay algo importante, como él prefiera) y avisos si algo preocupa.

Etapa 2 (semi-automática): la IA platica, resume y detecta alertas; **nada le llega a la familia sin que tú lo apruebes**, salvo las alertas rojas confirmadas.

---

## Qué incluye

| Parte | Dónde | Qué hace |
| --- | --- | --- |
| Página de venta | `src/app/page.tsx` | Explica el servicio, precio, preguntas frecuentes |
| Registro de familias | `src/app/alta` | Datos de la familia, de ella, medicinas, ficha de emergencia, contacto cercano y consentimientos |
| Panel de revisión | `src/app/panel` | Aprobar resúmenes, atender alertas, registrar consentimientos, pausar llamadas |
| Cerebro de la IA | `src/lib/ai/instrucciones.ts` | Cómo platica, cómo clasifica alertas, cómo resume. **El archivo más importante.** |
| Red de seguridad | `src/lib/ai/senales.ts` | Detecta frases de riesgo sin IA ("me caí", "me duele el pecho"...) |
| Lógica del servicio | `src/lib/acompana.ts` | Saludo diario, reintentos, plática, alertas, resúmenes |
| WhatsApp | `src/lib/whatsapp`, `src/app/api/whatsapp` | Recibe y manda mensajes por la API oficial de Meta |
| Voz | `src/lib/voz` | Entiende sus notas de voz (OpenAI) y le responde con voz mexicana (Azure) |
| Ficha viva | `src/lib/ficha.ts` | Su gente, citas, historias, recordatorios al hijo y la respuesta a "¿cómo va mi mamá?" |
| Página de la familia | `src/app/mama/[token]` | Enlace privado: medicinas con días restantes, citas, lo que contó del doctor e historias con su voz |
| Programador | `src/app/api/cron` | Se llama cada 5 minutos |
| Cobros | `src/lib/cobros.ts`, `src/app/api/stripe` | 14 días gratis y suscripción mensual con Stripe |
| Revisión de configuración | `/api/salud` | Te dice qué variables faltan |

**Cómo decide las alertas**

- **Roja** (caída, dolor de pecho, falta de aire, señales de embolia, habla de quitarse la vida, robo): te llega a ti al instante. Si la IA también lo ve rojo, le llega a la familia y al contacto cercano al instante. Si solo lo detectan las reglas, te llega primero a ti para que lo confirmes. **La IA nunca llama al 911 sola.**
- **Amarilla** (dolor, mareo, no comió, tristeza, posible fraude, no contestó en el día): te llega a ti; la familia se entera en el resumen, que revisas antes de que salga.
- **Verde**: va en el resumen.

---

## Probar en tu computadora (sin WhatsApp)

```
npm install
npm run probar
```

Abre http://localhost:3000/panel/probar (contraseña: `prueba`) y pulsa **Crear una familia de prueba**. Verás dos celulares simulados: en el de la mamá escribes como ella y en el del hijo ves lo que le llega (y puedes contestar como él: "¿cómo va mi mamá?", "solo lo importante"). Los botones mandan el saludo del día, terminan la plática para hacer el resumen y mandan los recordatorios.

- No sale nada a WhatsApp ni se gasta nada. La base de datos vive dentro de la app, en la carpeta `.pglite` (sin puertos ni instalar Postgres). Para empezar de cero total, cierra la app y borra esa carpeta.
- Sin `ANTHROPIC_API_KEY` en tu `.env`, la IA contesta con respuestas de ejemplo. Con la clave, platicas con la IA de verdad (unos centavos de dólar por plática).
- Las notas de voz se muestran como texto. La voz real se prueba ya con WhatsApp.
- Necesitas Node 20 o más nuevo ([nodejs.org](https://nodejs.org)).

### Con tu propia configuración (avanzado)

```bash
npm install
cp .env.example .env        # y llena al menos ADMIN_PASSWORD, SESSION_SECRET
npm run db:local            # base de datos de prueba en otra terminal (se borra al cerrarla)
```

En tu `.env` pon `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres` y luego:

```bash
npm run db:migrate          # crea las tablas
npm run dev                 # abre http://localhost:3000
```

- Página: `http://localhost:3000`
- Registro: `http://localhost:3000/alta`
- Panel: `http://localhost:3000/panel`

Pruebas automáticas (no necesitan llaves ni internet):

```bash
npm test
```

Probar la IA de verdad con pláticas simuladas (necesita `ANTHROPIC_API_KEY`):

```bash
npm run simular             # todos los escenarios
npm run simular -- caida    # uno: normal, triste, caida, fraude, pregunta_medica, quien_eres, historia, extrana_al_hijo, chisme
```

Hazlo antes de atender a la primera familia y cada vez que cambies las instrucciones.

---

## Ponerlo en internet (en este orden)

### 1. Base de datos
Crea una base Postgres gratis en [Neon](https://neon.tech) o [Supabase](https://supabase.com). Copia la cadena de conexión a `DATABASE_URL` y corre `npm run db:migrate` con esa variable.

### 2. Subir la app a Vercel
1. Entra a [vercel.com](https://vercel.com), importa este repositorio de GitHub.
2. En **Settings → Environment Variables** pega todas las variables de `.env.example` con tus valores.
3. Despliega. Tu app queda en algo como `https://acompana.vercel.app` (pon esa URL en `APP_URL`).
4. Abre `https://TU-URL/api/salud`: te dice qué falta.

### 3. WhatsApp Business (lo que más tarda: empieza hoy)
1. En [developers.facebook.com](https://developers.facebook.com) crea una app de tipo **Business** y agrega el producto **WhatsApp**.
2. Registra un número que **no** uses en tu WhatsApp personal y verifica tu negocio en Meta Business.
3. Crea un **token permanente** (usuario del sistema) → `WHATSAPP_TOKEN`. Copia el **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
4. En **WhatsApp → Configuración → Webhook**: URL `https://TU-URL/api/whatsapp`, token de verificación = el que pusiste en `WHATSAPP_VERIFY_TOKEN`. Suscríbete al campo **messages**.
5. Copia el **App secret** (Configuración básica de la app) → `WHATSAPP_APP_SECRET`.
6. Crea y manda a aprobar las 7 plantillas de [`docs/plantillas-whatsapp.md`](docs/plantillas-whatsapp.md).

### 4. IA y voz
- **Claude** (platica, clasifica y resume): llave en [console.anthropic.com](https://console.anthropic.com) → `ANTHROPIC_API_KEY`.
- **OpenAI** (entiende sus notas de voz): llave en [platform.openai.com](https://platform.openai.com) → `OPENAI_API_KEY`. Usamos `gpt-transcribe`, el modelo vigente; `whisper-1` y `gpt-4o-transcribe` se retiran el 26 de febrero de 2027.
- **Azure Speech** (le responde con voz y acento mexicano): en [portal.azure.com](https://portal.azure.com) crea un recurso **Speech**, copia la llave → `AZURE_SPEECH_KEY` y la región → `AZURE_SPEECH_REGION`. Voces: `es-MX-DaliaNeural` (mujer) o `es-MX-JorgeNeural` (hombre). Elegimos Azure porque los modelos de voz de OpenAI que funcionan con notas de voz se retiran el 6 de enero de 2027 y porque tiene acento mexicano. Si prefieres OpenAI mientras tanto, pon `VOZ_PROVEEDOR=openai`.

Los nombres de modelos y voces se cambian en el `.env` sin tocar código.

### 5. El programador (cada 5 minutos)
`vercel.json` ya pide a Vercel llamar `/api/cron` cada 5 minutos, pero el plan gratuito de Vercel limita la frecuencia de los cron. Si no te deja, usa [cron-job.org](https://cron-job.org) (gratis) con la URL:

```
https://TU-URL/api/cron?secreto=TU_CRON_SECRET
```

### 6. Cobros con Stripe (puede esperar a tus primeras familias)
1. En [Stripe](https://dashboard.stripe.com) crea un producto "Acompañamiento diario" con dos precios mensuales: $499 MXN y $29 USD. Copia sus IDs a `STRIPE_PRECIO_BASICO_MXN` y `STRIPE_PRECIO_BASICO_USD` (los de "completo" puedes repetirlos por ahora).
2. Crea un cupón **FUNDADOR** de 30% "para siempre", limitado a 30 usos (el precio de fundador de la página).
3. Webhook a `https://TU-URL/api/stripe/webhook` con los eventos `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` → `STRIPE_WEBHOOK_SECRET`.

Sin Stripe configurado, el registro funciona igual y la familia queda en prueba sin tarjeta.

---

## Cuánto cuesta operarlo

Revisa siempre los precios vigentes; esto es lo que debes considerar:

- **WhatsApp**: desde julio de 2025 Meta cobra por mensaje y, desde el 1 de octubre de 2026, también los mensajes de servicio después de los primeros 1,000 gratis al mes por número, y los de utilidad dentro de la ventana de 24 horas. Una plática diaria son unos 6 a 10 mensajes salientes, así que con 30 familias pasas de los 1,000 gratis. Consulta la tarifa de México en la [página de precios de Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing).
- **Claude**: una plática corta más su resumen consume poco; usa el modelo rápido (`ANTHROPIC_MODEL_RAPIDO`) para revisar alertas.
- **Voz**: OpenAI cobra por minuto transcrito y Azure por caracteres convertidos a voz (Azure tiene un nivel gratuito mensual).

Por eso las respuestas de la IA son cortas: además de ser mejores para ella, cuestan menos.

## Cómo se opera un día

1. **Familia nueva**: te llega un WhatsApp. Agenda la videollamada de bienvenida.
2. **Videollamada**: deja su teléfono listo (volumen, número guardado como "Acompaña"), practica una nota de voz y pídele su consentimiento por escrito. Regístralo en **Panel → Familias → Registrar y activar llamadas**. Sin consentimiento no hay llamadas.
3. **Cada mañana**: el saludo sale solo a la hora elegida. Si no contesta, se reintenta a las 2 y 4 horas; si sigue sin contestar, te llega una alerta.
4. **Resúmenes**: los días normales salen solos. Los amarillos y rojos esperan en **Panel → Resúmenes por revisar**: lee la plática, corrige el resumen y aprueba. Con `REVISAR_RESUMENES=todos` revisas todos; con `ninguno`, ninguno.
5. **Alertas**: en **Panel → Alertas** tienes el protocolo, los teléfonos y la ficha de emergencia. Anota qué hiciste y márcala como atendida.
6. **Medicinas y citas**: las registra la familia en la página de su mamá. A ella nunca se le habla de que se le acaba una medicina; el aviso le llega al hijo 5 días antes. Un día antes de cada cita el hijo recibe un recordatorio, y 3 horas después de la cita (si ella escribió en las últimas 23 horas) la IA le pregunta cómo le fue; si no, se lo pregunta en la siguiente plática.
7. **Historias con su voz**: la IA le pide permiso cada vez. Solo si dice que sí se guarda en su página. Asegúrate de que el consentimiento que firma en la bienvenida mencione esto.
8. **Familiares que escriben**: si un familiar pregunta "¿cómo va?", por sus medicinas o sus citas, se le contesta solo con lo último y el enlace a su página. Con "solo lo importante" o "todos los días" elige cuándo le escribimos. Cualquier otro mensaje te llega a tu WhatsApp para que lo contestes tú. Acompaña nunca le pasa mensajes a ella de parte de su familia: eso es entre ellos.
9. **Cambios**: en **Panel → Familias** puedes cambiar la hora del saludo, si responde con voz o texto, medicinas, contactos y ficha de emergencia.
10. **Cada viernes**: revisa los errores de la IA que anotaste y mejora `src/lib/ai/instrucciones.ts`.

Para cambiar tu nombre, tu historia, el correo o los precios de la página: `src/lib/marca.ts`.

---

## Pendiente (lo que todavía no hace)

- Llamadas a teléfono fijo o celular sin WhatsApp.
- Segunda plática por la tarde, reporte semanal y plan completo.
- Llamadas de voz en tiempo real: la API de llamadas de WhatsApp ya existe, pero exige pedir permiso de llamada a cada persona y tiene límites diarios; vale la pena cuando tengas clientes.
- Revisión legal del aviso de privacidad y los términos (`src/app/privacidad`, `src/app/terminos`): están marcados como versión preliminar.
- Foto real tuya en la página (reemplaza el círculo con la inicial).
