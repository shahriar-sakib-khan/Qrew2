CREATE TABLE "project_statuses" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD COLUMN "project_status_id" text;--> statement-breakpoint
ALTER TABLE "project_statuses" ADD CONSTRAINT "project_statuses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_project_status_id_project_statuses_id_fk" FOREIGN KEY ("project_status_id") REFERENCES "public"."project_statuses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_status_project_statuses_id_fk" FOREIGN KEY ("status") REFERENCES "public"."project_statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" DROP COLUMN "status";