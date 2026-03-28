ALTER TABLE "employees" DROP CONSTRAINT "employees_email_unique";--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "created_by_employee_id" integer;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "google_auth" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "is_email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "email_verification_token" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "email_verification_expires" timestamp;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "password_reset_token" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "password_reset_expires" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "employees_email_company_id_unique" ON "employees" USING btree ("email","company_id");