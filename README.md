# Acompaña

Acompañamiento diario por WhatsApp para personas mayores. Cada mañana una IA platica con la persona por notas de voz; una persona de tu equipo revisa la plática y la familia recibe un resumen y avisos si algo preocupa.

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
| Voz | `src/lib/voz/voz.ts` | Notas de voz a texto y respuestas en voz |
| Programador | `src/app/api/cron` | Se llama cada 5 minutos |
| Cobros | `src/lib/cobros.ts`, `src/app/api/stripe` | 14 días gratis y suscripción mensual con Stripe |
| Revisión de configuración | `/api/salud` | Te dice qué variables faltan |

**Cómo decide las alertas**

- **Roja** (caída, dolor de pecho, falta de aire, señales de embolia, habla de quitarse la vida, robo): te llega a ti al instante. Si la IA también lo ve rojo, le llega a la familia y al contacto cercano al instante. Si solo lo detectan las reglas, te llega primero a ti para que lo confirmes. **La IA nunca llama al 911 sola.**
- **Amarilla** (dolor, mareo, no comió, tristeza, posible fraude, no contestó en el día): te llega a ti; la familia se entera en el resumen que apruebas.
- **Verde**: va en el resumen.

---

## Probarlo en tu computadora

Necesitas Node 20 o más nuevo.

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
npm run simular -- caida    # uno: normal, triste, caida, fraude, pregunta_medica, quien_eres
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
6. Crea y manda a aprobar las 4 plantillas de [`docs/plantillas-whatsapp.md`](docs/plantillas-whatsapp.md).

### 4. IA y voz
- Llave de Claude en [console.anthropic.com](https://console.anthropic.com) → `ANTHROPIC_API_KEY`.
- Llave de OpenAI en [platform.openai.com](https://platform.openai.com) (voz a texto y texto a voz) → `OPENAI_API_KEY`.

Revisa en sus páginas los modelos y precios vigentes; los nombres de modelo se cambian en el `.env` sin tocar código.

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

## Cómo se opera un día

1. **Familia nueva**: te llega un WhatsApp. Agenda la videollamada de bienvenida.
2. **Videollamada**: deja su teléfono listo (volumen, número guardado como "Acompaña"), practica una nota de voz y pídele su consentimiento por escrito. Regístralo en **Panel → Familias → Registrar y activar llamadas**. Sin consentimiento no hay llamadas.
3. **Cada mañana**: el saludo sale solo a la hora elegida. Si no contesta, se reintenta a las 2 y 4 horas; si sigue sin contestar, te llega una alerta.
4. **Resúmenes**: en **Panel → Resúmenes por revisar**, lee la plática, corrige el resumen y aprueba. Primero aparecen rojos y amarillos.
5. **Alertas**: en **Panel → Alertas** tienes el protocolo, los teléfonos y la ficha de emergencia. Anota qué hiciste y márcala como atendida.
6. **Cada viernes**: revisa los errores de la IA que anotaste y mejora `src/lib/ai/instrucciones.ts`.

Para cambiar tu nombre, tu historia, el correo o los precios de la página: `src/lib/marca.ts`.

---

## Pendiente (lo que todavía no hace)

- Llamadas a teléfono fijo o celular sin WhatsApp.
- Segunda plática por la tarde, reporte semanal y plan completo.
- Mensajes de voz del hijo que se le pasan a la mamá.
- Agregar o editar contactos y medicinas desde el panel (por ahora, en la base de datos).
- Revisión legal del aviso de privacidad y los términos (`src/app/privacidad`, `src/app/terminos`): están marcados como versión preliminar.
- Foto real tuya en la página (reemplaza el círculo con la inicial).
