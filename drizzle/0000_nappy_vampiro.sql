CREATE TABLE "adultos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"como_llamarle" text NOT NULL,
	"telefono" text NOT NULL,
	"zona_horaria" text DEFAULT 'America/Mexico_City' NOT NULL,
	"hora_saludo" text DEFAULT '09:00' NOT NULL,
	"canal" text DEFAULT 'voz' NOT NULL,
	"sobre_ella" text DEFAULT '' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"consentimiento_en" timestamp with time zone,
	"consentimiento_metodo" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alertas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adulto_id" uuid NOT NULL,
	"platica_id" uuid,
	"nivel" text NOT NULL,
	"motivo" text NOT NULL,
	"frase" text DEFAULT '' NOT NULL,
	"estado" text DEFAULT 'abierta' NOT NULL,
	"nota_atencion" text,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"atendida_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contactos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"familia_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text NOT NULL,
	"relacion" text NOT NULL,
	"recibe_resumen" boolean DEFAULT true NOT NULL,
	"recibe_alertas" boolean DEFAULT true NOT NULL,
	"puede_acudir" boolean DEFAULT false NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "familias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre_contacto" text NOT NULL,
	"telefono" text NOT NULL,
	"email" text NOT NULL,
	"plan" text DEFAULT 'basico' NOT NULL,
	"moneda" text DEFAULT 'mxn' NOT NULL,
	"estado" text DEFAULT 'prueba' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"prueba_termina_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fichas_emergencia" (
	"adulto_id" uuid PRIMARY KEY NOT NULL,
	"direccion" text DEFAULT '' NOT NULL,
	"referencias" text DEFAULT '' NOT NULL,
	"enfermedades" text DEFAULT '' NOT NULL,
	"alergias" text DEFAULT '' NOT NULL,
	"tipo_sangre" text DEFAULT '' NOT NULL,
	"seguro" text DEFAULT '' NOT NULL,
	"hospital_cercano" text DEFAULT '' NOT NULL,
	"quien_tiene_llave" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medicinas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adulto_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"dosis" text DEFAULT '' NOT NULL,
	"horario" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mensajes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platica_id" uuid NOT NULL,
	"de" text NOT NULL,
	"tipo" text NOT NULL,
	"texto" text NOT NULL,
	"wa_message_id" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platicas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adulto_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"estado" text DEFAULT 'enviada' NOT NULL,
	"intentos" integer DEFAULT 1 NOT NULL,
	"enviada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"ultima_actividad_en" timestamp with time zone DEFAULT now() NOT NULL,
	"terminada_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "resumenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platica_id" uuid NOT NULL,
	"nivel" text NOT NULL,
	"texto_borrador" text NOT NULL,
	"texto_final" text,
	"datos" jsonb NOT NULL,
	"memoria" text DEFAULT '' NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"revisado_por" text,
	"enviado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adultos" ADD CONSTRAINT "adultos_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_adulto_id_adultos_id_fk" FOREIGN KEY ("adulto_id") REFERENCES "public"."adultos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_platica_id_platicas_id_fk" FOREIGN KEY ("platica_id") REFERENCES "public"."platicas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contactos" ADD CONSTRAINT "contactos_familia_id_familias_id_fk" FOREIGN KEY ("familia_id") REFERENCES "public"."familias"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fichas_emergencia" ADD CONSTRAINT "fichas_emergencia_adulto_id_adultos_id_fk" FOREIGN KEY ("adulto_id") REFERENCES "public"."adultos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicinas" ADD CONSTRAINT "medicinas_adulto_id_adultos_id_fk" FOREIGN KEY ("adulto_id") REFERENCES "public"."adultos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_platica_id_platicas_id_fk" FOREIGN KEY ("platica_id") REFERENCES "public"."platicas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platicas" ADD CONSTRAINT "platicas_adulto_id_adultos_id_fk" FOREIGN KEY ("adulto_id") REFERENCES "public"."adultos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumenes" ADD CONSTRAINT "resumenes_platica_id_platicas_id_fk" FOREIGN KEY ("platica_id") REFERENCES "public"."platicas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "adultos_telefono_idx" ON "adultos" USING btree ("telefono");--> statement-breakpoint
CREATE INDEX "alertas_estado_idx" ON "alertas" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "contactos_familia_idx" ON "contactos" USING btree ("familia_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mensajes_wa_idx" ON "mensajes" USING btree ("wa_message_id");--> statement-breakpoint
CREATE INDEX "mensajes_platica_idx" ON "mensajes" USING btree ("platica_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platicas_adulto_fecha_idx" ON "platicas" USING btree ("adulto_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "resumenes_platica_idx" ON "resumenes" USING btree ("platica_id");