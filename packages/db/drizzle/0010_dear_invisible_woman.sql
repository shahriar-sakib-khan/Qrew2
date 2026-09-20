CREATE TABLE "invoice_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"document_type" "document_type_enum" DEFAULT 'general' NOT NULL,
	"scope" "template_scope_enum" DEFAULT 'organization' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_by_user_id" text,
	"source_template_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"name" text NOT NULL,
	"section_token" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "template_section_token_unique" UNIQUE("template_id","section_token")
);
--> statement-breakpoint
ALTER TABLE "invoice_templates" ADD CONSTRAINT "invoice_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_templates" ADD CONSTRAINT "invoice_templates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_templates" ADD CONSTRAINT "invoice_templates_source_template_id_invoice_templates_id_fk" FOREIGN KEY ("source_template_id") REFERENCES "public"."invoice_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_sections" ADD CONSTRAINT "template_sections_template_id_invoice_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."invoice_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_templates_org_scope_archived_idx" ON "invoice_templates" USING btree ("organization_id","scope","is_archived");--> statement-breakpoint
CREATE INDEX "template_sections_template_sort_idx" ON "template_sections" USING btree ("template_id","sort_order");