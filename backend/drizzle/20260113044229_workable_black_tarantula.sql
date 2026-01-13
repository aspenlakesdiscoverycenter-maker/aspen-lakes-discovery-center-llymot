CREATE TABLE "child_check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"classroom_id" uuid NOT NULL,
	"check_in_time" timestamp NOT NULL,
	"check_out_time" timestamp,
	"total_hours" numeric(5, 2),
	"date" timestamp NOT NULL,
	"checked_in_by" text NOT NULL,
	"checked_out_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classroom_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"classroom_id" uuid NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"removed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classrooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"capacity" integer NOT NULL,
	"age_group" text,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" text NOT NULL,
	"sign_in_time" timestamp NOT NULL,
	"sign_out_time" timestamp,
	"total_hours" numeric(5, 2),
	"date" timestamp NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "child_check_ins" ADD CONSTRAINT "child_check_ins_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_check_ins" ADD CONSTRAINT "child_check_ins_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_assignments" ADD CONSTRAINT "classroom_assignments_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_assignments" ADD CONSTRAINT "classroom_assignments_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "child_check_ins_child_id_idx" ON "child_check_ins" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "child_check_ins_classroom_id_idx" ON "child_check_ins" USING btree ("classroom_id");--> statement-breakpoint
CREATE INDEX "child_check_ins_date_idx" ON "child_check_ins" USING btree ("date");--> statement-breakpoint
CREATE INDEX "child_check_ins_check_out_time_idx" ON "child_check_ins" USING btree ("check_out_time");--> statement-breakpoint
CREATE INDEX "classroom_assignments_child_id_idx" ON "classroom_assignments" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "classroom_assignments_classroom_id_idx" ON "classroom_assignments" USING btree ("classroom_id");--> statement-breakpoint
CREATE INDEX "classroom_assignments_removed_at_idx" ON "classroom_assignments" USING btree ("removed_at");--> statement-breakpoint
CREATE INDEX "classrooms_name_idx" ON "classrooms" USING btree ("name");--> statement-breakpoint
CREATE INDEX "classrooms_is_active_idx" ON "classrooms" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "staff_attendance_staff_id_idx" ON "staff_attendance" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_attendance_date_idx" ON "staff_attendance" USING btree ("date");--> statement-breakpoint
CREATE INDEX "staff_attendance_sign_out_time_idx" ON "staff_attendance" USING btree ("sign_out_time");