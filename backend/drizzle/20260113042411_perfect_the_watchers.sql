CREATE TABLE "report_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"parent_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"parent_id" text NOT NULL,
	"reaction_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_reports" ADD COLUMN "videos" jsonb;--> statement-breakpoint
ALTER TABLE "daily_reports" ADD COLUMN "medications" jsonb;--> statement-breakpoint
ALTER TABLE "daily_reports" ADD COLUMN "incidents" jsonb;--> statement-breakpoint
ALTER TABLE "report_comments" ADD CONSTRAINT "report_comments_report_id_daily_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."daily_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_reactions" ADD CONSTRAINT "report_reactions_report_id_daily_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."daily_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_comments_report_id_idx" ON "report_comments" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "report_comments_parent_id_idx" ON "report_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "report_reactions_report_id_idx" ON "report_reactions" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "report_reactions_parent_id_idx" ON "report_reactions" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_reactions_unique_idx" ON "report_reactions" USING btree ("report_id","parent_id");