CREATE TABLE "staff_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"hire_date" timestamp NOT NULL,
	"employment_status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "time_off_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" text NOT NULL,
	"year" integer NOT NULL,
	"vacation_days_allotted" integer NOT NULL,
	"vacation_days_used" integer DEFAULT 0 NOT NULL,
	"sick_days_allotted" integer NOT NULL,
	"sick_days_used" integer DEFAULT 0 NOT NULL,
	"unpaid_days_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_off_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"days_requested" integer NOT NULL,
	"type" text NOT NULL,
	"reason" text,
	"notes" text,
	"status" text DEFAULT 'pending',
	"approved_by" text,
	"approval_date" timestamp,
	"approval_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_user_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_profiles_user_id_idx" ON "staff_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "time_off_balances_staff_id_idx" ON "time_off_balances" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "time_off_balances_year_idx" ON "time_off_balances" USING btree ("year");--> statement-breakpoint
CREATE UNIQUE INDEX "time_off_balances_unique_idx" ON "time_off_balances" USING btree ("staff_id","year");--> statement-breakpoint
CREATE INDEX "time_off_requests_staff_id_idx" ON "time_off_requests" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "time_off_requests_status_idx" ON "time_off_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "time_off_requests_start_date_idx" ON "time_off_requests" USING btree ("start_date");