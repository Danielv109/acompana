ALTER TABLE "familias" ADD COLUMN "avisos" text DEFAULT 'diario' NOT NULL;--> statement-breakpoint
ALTER TABLE "resumenes" ADD COLUMN "aviso" text;--> statement-breakpoint
ALTER TABLE "resumenes" ADD COLUMN "importante" boolean DEFAULT false NOT NULL;