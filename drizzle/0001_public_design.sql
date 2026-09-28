ALTER TABLE "departments" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "tagline" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "image_url" text;--> statement-breakpoint
CREATE UNIQUE INDEX "departments_slug_uq" ON "departments" USING btree ("slug");