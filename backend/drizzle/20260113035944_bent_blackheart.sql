ALTER TABLE "children" ADD COLUMN "street" text;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "province" text;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "general_health" text;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "alberta_healthcare_number" text;--> statement-breakpoint
CREATE INDEX "children_last_name_idx" ON "children" USING btree ("last_name");