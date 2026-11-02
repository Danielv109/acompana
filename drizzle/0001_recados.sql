CREATE TABLE "recados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adulto_id" uuid NOT NULL,
	"contacto_id" uuid,
	"de_quien" text NOT NULL,
	"texto" text NOT NULL,
	"platica_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"entregado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "recados" ADD CONSTRAINT "recados_adulto_id_adultos_id_fk" FOREIGN KEY ("adulto_id") REFERENCES "public"."adultos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recados" ADD CONSTRAINT "recados_contacto_id_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."contactos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recados" ADD CONSTRAINT "recados_platica_id_platicas_id_fk" FOREIGN KEY ("platica_id") REFERENCES "public"."platicas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recados_adulto_idx" ON "recados" USING btree ("adulto_id");