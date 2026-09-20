ALTER TYPE "public"."project_status" RENAME TO "project_lifecycle_state";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "lifecycle_state" "project_lifecycle_state" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "public"."projects" ALTER COLUMN "lifecycle_state" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."project_lifecycle_state";--> statement-breakpoint
CREATE TYPE "public"."project_lifecycle_state" AS ENUM('open', 'completed', 'canceled', 'archived');--> statement-breakpoint
ALTER TABLE "public"."projects" ALTER COLUMN "lifecycle_state" SET DATA TYPE "public"."project_lifecycle_state" USING "lifecycle_state"::"public"."project_lifecycle_state";