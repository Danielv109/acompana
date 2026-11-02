CREATE TABLE "bandeja" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telefono" text NOT NULL,
	"direccion" text NOT NULL,
	"tipo" text NOT NULL,
	"texto" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "bandeja_telefono_idx" ON "bandeja" USING btree ("telefono","creado_en");