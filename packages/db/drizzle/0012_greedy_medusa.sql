CREATE TABLE "template_header_fields" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"field_type" "header_field_type_enum" NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"column_position" text DEFAULT 'left' NOT NULL,
	"file_field_key" text,
	"is_formula_injectable" boolean DEFAULT false NOT NULL,
	"org_config_key" text,
	"default_manual_value" text,
	"placeholder" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"source_template_id" text,
	"source_template_version" integer,
	"draft_header_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"draft_sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_auto_saved_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_drafts_project_user_unique" UNIQUE("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "invoice_reserved_numbers" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"document_type" "document_type_enum" NOT NULL,
	"document_number" text NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL,
	"used_by_invoice_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_reserved_numbers_project_doctype_unique" UNIQUE("project_id","document_type")
);
--> statement-breakpoint
ALTER TABLE "template_header_fields" ADD CONSTRAINT "template_header_fields_template_id_invoice_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."invoice_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_drafts" ADD CONSTRAINT "invoice_drafts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_drafts" ADD CONSTRAINT "invoice_drafts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_drafts" ADD CONSTRAINT "invoice_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_drafts" ADD CONSTRAINT "invoice_drafts_source_template_id_invoice_templates_id_fk" FOREIGN KEY ("source_template_id") REFERENCES "public"."invoice_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_reserved_numbers" ADD CONSTRAINT "invoice_reserved_numbers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_reserved_numbers" ADD CONSTRAINT "invoice_reserved_numbers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_reserved_numbers" ADD CONSTRAINT "invoice_reserved_numbers_used_by_invoice_id_invoices_id_fk" FOREIGN KEY ("used_by_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "template_header_fields_template_sort_idx" ON "template_header_fields" USING btree ("template_id","sort_order");