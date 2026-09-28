CREATE TYPE "public"."qr_target_type" AS ENUM('job', 'page');--> statement-breakpoint
CREATE TABLE "qr_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"target_type" "qr_target_type" NOT NULL,
	"job_id" uuid,
	"path" text,
	"source" text,
	"active" boolean DEFAULT true NOT NULL,
	"scan_count" integer DEFAULT 0 NOT NULL,
	"last_scanned_at" timestamp with time zone,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "qr_codes_code_uq" ON "qr_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "qr_codes_job_idx" ON "qr_codes" USING btree ("job_id");--> statement-breakpoint
-- Move existing per-job QR codes into the central table (codes keep their label, source and scan count).
INSERT INTO "qr_codes" ("code", "label", "target_type", "job_id", "source", "scan_count", "created_by_id", "created_at", "updated_at")
SELECT substr(md5(random()::text || q."id"::text), 1, 10), j."title" || ' – ' || q."label", 'job', q."job_id", NULLIF(q."source", ''), q."scan_count", q."created_by_id", q."created_at", q."updated_at"
FROM "job_qr_codes" q
JOIN "jobs" j ON j."id" = q."job_id";
