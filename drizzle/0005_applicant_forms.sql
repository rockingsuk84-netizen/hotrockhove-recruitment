CREATE TYPE "public"."form_request_status" AS ENUM('sent', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."form_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."interview_mode" AS ENUM('in_person', 'online', 'phone');--> statement-breakpoint
CREATE TYPE "public"."interview_status" AS ENUM('scheduled', 'cancelled');--> statement-breakpoint
CREATE TABLE "form_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"applicant_id" uuid NOT NULL,
	"application_id" uuid,
	"definition" jsonb NOT NULL,
	"token_hash" text NOT NULL,
	"status" "form_request_status" DEFAULT 'sent' NOT NULL,
	"email_status" "notification_status" DEFAULT 'queued' NOT NULL,
	"sent_by_id" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cv_document_id" uuid,
	"completed_at" timestamp with time zone,
	"decision" text,
	"decision_note" text,
	"decided_by_id" text,
	"decided_at" timestamp with time zone,
	"offer_emailed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"definition" jsonb NOT NULL,
	"status" "form_status" DEFAULT 'active' NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"applicant_id" uuid NOT NULL,
	"application_id" uuid,
	"form_request_id" uuid,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"mode" "interview_mode" NOT NULL,
	"location" text,
	"meeting_link" text,
	"contact_name" text,
	"notes" text,
	"status" "interview_status" DEFAULT 'scheduled' NOT NULL,
	"email_status" "notification_status" DEFAULT 'queued' NOT NULL,
	"invited_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_applicant_id_applicants_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."applicants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_sent_by_id_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_cv_document_id_documents_id_fk" FOREIGN KEY ("cv_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_applicant_id_applicants_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."applicants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_form_request_id_form_requests_id_fk" FOREIGN KEY ("form_request_id") REFERENCES "public"."form_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "form_requests_token_uq" ON "form_requests" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "form_requests_form_idx" ON "form_requests" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "form_requests_applicant_idx" ON "form_requests" USING btree ("applicant_id");--> statement-breakpoint
CREATE INDEX "forms_status_idx" ON "forms" USING btree ("status");--> statement-breakpoint
CREATE INDEX "interviews_applicant_idx" ON "interviews" USING btree ("applicant_id");--> statement-breakpoint
CREATE INDEX "interviews_form_request_idx" ON "interviews" USING btree ("form_request_id");--> statement-breakpoint
CREATE INDEX "interviews_scheduled_idx" ON "interviews" USING btree ("scheduled_at");