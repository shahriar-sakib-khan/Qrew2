ALTER TABLE "clients" ADD COLUMN "status" "client_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD COLUMN "is_detailed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD COLUMN "is_sensitive" boolean DEFAULT false NOT NULL;