CREATE TABLE "citas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adulto_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"hora" text DEFAULT '' NOT NULL,
	"con_quien" text NOT NULL,
	"lugar" text DEFAULT '' NOT NULL,
	"lo_que_conto" text,
	"recordatorio_enviado_en" timestamp with time zone,
	"seguimiento" text DEFAULT 'pendiente' NOT NULL,
	"creada_por" text DEFAULT '' NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adulto_id" uuid NOT NULL,
	"platica_id" uuid,
	"titulo" text NOT NULL,
	"texto" text NOT NULL,
	"audios" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adulto_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"relacion" text DEFAULT '' NOT NULL,
	"notas" text DEFAULT '' NOT NULL,
	"cumpleanos" text,
	"recordado_anio" integer,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "familias" ADD COLUMN "token_pagina" text;--> statement-breakpoint
UPDATE "familias" SET "token_pagina" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') WHERE "token_pagina" IS NULL;--> statement-breakpoint
ALTER TABLE "medicinas" ADD COLUMN "ultimo_surtido" date;--> statement-breakpoint
ALTER TABLE "medicinas" ADD COLUMN "dura_dias" integer;--> statement-breakpoint
ALTER TABLE "medicinas" ADD COLUMN "recordado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mensajes" ADD COLUMN "audio" "bytea";--> statement-breakpoint
ALTER TABLE "mensajes" ADD COLUMN "audio_mime" text;--> statement-breakpoint
ALTER TABLE "citas" ADD CONSTRAINT "citas_adulto_id_adultos_id_fk" FOREIGN KEY ("adulto_id") REFERENCES "public"."adultos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historias" ADD CONSTRAINT "historias_adulto_id_adultos_id_fk" FOREIGN KEY ("adulto_id") REFERENCES "public"."adultos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historias" ADD CONSTRAINT "historias_platica_id_platicas_id_fk" FOREIGN KEY ("platica_id") REFERENCES "public"."platicas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_adulto_id_adultos_id_fk" FOREIGN KEY ("adulto_id") REFERENCES "public"."adultos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "citas_adulto_fecha_idx" ON "citas" USING btree ("adulto_id","fecha");--> statement-breakpoint
CREATE INDEX "historias_adulto_idx" ON "historias" USING btree ("adulto_id");--> statement-breakpoint
CREATE UNIQUE INDEX "personas_adulto_nombre_idx" ON "personas" USING btree ("adulto_id","nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "familias_token_idx" ON "familias" USING btree ("token_pagina");