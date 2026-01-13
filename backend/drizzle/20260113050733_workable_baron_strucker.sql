CREATE TABLE "staff_classroom_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" text NOT NULL,
	"classroom_id" uuid NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"removed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "is_kindergarten_enrolled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff_classroom_assignments" ADD CONSTRAINT "staff_classroom_assignments_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_classroom_assignments_staff_id_idx" ON "staff_classroom_assignments" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_classroom_assignments_classroom_id_idx" ON "staff_classroom_assignments" USING btree ("classroom_id");--> statement-breakpoint
CREATE INDEX "staff_classroom_assignments_removed_at_idx" ON "staff_classroom_assignments" USING btree ("removed_at");--> statement-breakpoint
CREATE INDEX "children_is_kindergarten_enrolled_idx" ON "children" USING btree ("is_kindergarten_enrolled");