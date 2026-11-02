/**
 * Lectura de variables de entorno.
 * Se leen al momento de usarse (no al importar) para que la app compile sin tenerlas todas.
 */
function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}. Revisa tu archivo .env (ver .env.example).`);
  }
  return valor;
}

function opcional(nombre: string, porDefecto: string): string {
  return process.env[nombre] || porDefecto;
}

export const env = {
  get appUrl() { return opcional("APP_URL", "http://localhost:3000"); },
  get databaseUrl() { return requerida("DATABASE_URL"); },
  get adminPassword() { return requerida("ADMIN_PASSWORD"); },
  get sessionSecret() { return requerida("SESSION_SECRET"); },
  get adminWhatsapp() { return process.env.ADMIN_WHATSAPP ?? ""; },
  get cronSecret() { return requerida("CRON_SECRET"); },

  get anthropicKey() { return requerida("ANTHROPIC_API_KEY"); },
  get modelo() { return opcional("ANTHROPIC_MODEL", "claude-sonnet-5-5"); },
  get modeloRapido() { return opcional("ANTHROPIC_MODEL_RAPIDO", "claude-haiku-5-5"); },

  get openaiKey() { return requerida("OPENAI_API_KEY"); },
  get sttModelo() { return opcional("OPENAI_STT_MODEL", "gpt-transcribe"); },
  get ttsModelo() { return opcional("OPENAI_TTS_MODEL", "gpt-4o-mini-tts"); },
  get ttsVoz() { return opcional("OPENAI_TTS_VOICE", "marin"); },

  get vozProveedor(): "azure" | "openai" { return process.env.VOZ_PROVEEDOR === "openai" ? "openai" : "azure"; },
  get azureKey() { return requerida("AZURE_SPEECH_KEY"); },
  get azureRegion() { return requerida("AZURE_SPEECH_REGION"); },
  get azureVoz() { return opcional("AZURE_VOZ", "es-MX-DaliaNeural"); },
  get azureVelocidad() { return opcional("AZURE_VELOCIDAD", "-5%"); },

  get whatsappToken() { return requerida("WHATSAPP_TOKEN"); },
  get whatsappPhoneId() { return requerida("WHATSAPP_PHONE_NUMBER_ID"); },
  get whatsappVerifyToken() { return requerida("WHATSAPP_VERIFY_TOKEN"); },
  get whatsappAppSecret() { return process.env.WHATSAPP_APP_SECRET ?? ""; },
  get whatsappVersion() { return opcional("WHATSAPP_API_VERSION", "v22.0"); },
  get idiomaPlantillas() { return opcional("WHATSAPP_IDIOMA_PLANTILLAS", "es_MX"); },
  get plantillaSaludo() { return opcional("WHATSAPP_PLANTILLA_SALUDO", "saludo_diario"); },
  get plantillaReintento() { return opcional("WHATSAPP_PLANTILLA_REINTENTO", "saludo_reintento"); },
  get plantillaRecordatorio() { return opcional("WHATSAPP_PLANTILLA_RECORDATORIO", "recordatorio_familia"); },
  get plantillaBienvenida() { return opcional("WHATSAPP_PLANTILLA_BIENVENIDA", "bienvenida_familia"); },
  get plantillaResumen() { return opcional("WHATSAPP_PLANTILLA_RESUMEN", "resumen_diario"); },
  get plantillaAlerta() { return opcional("WHATSAPP_PLANTILLA_ALERTA", "alerta_familia"); },
  get plantillaAvisoInterno() { return opcional("WHATSAPP_PLANTILLA_AVISO_INTERNO", "aviso_interno"); },

  get stripeKey() { return requerida("STRIPE_SECRET_KEY"); },
  get stripeWebhookSecret() { return requerida("STRIPE_WEBHOOK_SECRET"); },
  stripePrecio(plan: "basico" | "completo", moneda: "mxn" | "usd"): string {
    return requerida(`STRIPE_PRECIO_${plan.toUpperCase()}_${moneda.toUpperCase()}`);
  },
};
