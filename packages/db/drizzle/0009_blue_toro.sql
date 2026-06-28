CREATE TYPE "public"."account_status" AS ENUM('active', 'suspended', 'banned');--> statement-breakpoint
CREATE TYPE "public"."config_value_type_enum" AS ENUM('number', 'percentage', 'currency_rate', 'text');--> statement-breakpoint
CREATE TYPE "public"."document_type_enum" AS ENUM('pda', 'fda', 'proforma', 'general');--> statement-breakpoint
CREATE TYPE "public"."header_field_type_enum" AS ENUM('file_field', 'org_constant', 'manual');--> statement-breakpoint
CREATE TYPE "public"."invoice_status_enum" AS ENUM('draft', 'frozen', 'issued', 'paid', 'void', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."row_type_enum" AS ENUM('formula', 'constant', 'manual', 'section_aggregate', 'multi_value', 'header_label', 'grand_total');--> statement-breakpoint
CREATE TYPE "public"."template_scope_enum" AS ENUM('organization', 'preset');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_id" text NOT NULL,
	"target_user_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"ip_address" text DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_document_sequences" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_document_sequences_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "invoice_pdf_layouts" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"logo_url" text,
	"company_display_name" text,
	"company_tagline" text,
	"invoice_number_format" text DEFAULT '{DOC_TYPE}-{FILE_SEQ}' NOT NULL,
	"pda_prefix" text DEFAULT 'PDA' NOT NULL,
	"fda_prefix" text DEFAULT 'FDA' NOT NULL,
	"proforma_prefix" text DEFAULT 'PRO' NOT NULL,
	"general_prefix" text DEFAULT 'INV' NOT NULL,
	"current_doc_sequence" integer DEFAULT 0 NOT NULL,
	"default_payment_terms" text,
	"bank_details" jsonb,
	"extra_sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"footer_blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"show_subtotal_column" boolean DEFAULT true NOT NULL,
	"detail_column_separator" text DEFAULT 'newline' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_pdf_layouts_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "organization_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"config_key" text NOT NULL,
	"config_value" text NOT NULL,
	"display_label" text NOT NULL,
	"value_type" "config_value_type_enum" NOT NULL,
	"is_formula_injectable" boolean DEFAULT false NOT NULL,
	"updated_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_config_key_unique" UNIQUE("organization_id","config_key")
);
--> statement-breakpoint
CREATE TABLE "project_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"uploaded_by" text,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_type" text NOT NULL,
	"file_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "account_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "requires_password_reset" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_document_sequences" ADD CONSTRAINT "invoice_document_sequences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_pdf_layouts" ADD CONSTRAINT "invoice_pdf_layouts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_configs" ADD CONSTRAINT "organization_configs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_configs" ADD CONSTRAINT "organization_configs_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_attachments" ADD CONSTRAINT "project_attachments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_attachments" ADD CONSTRAINT "project_attachments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_attachments" ADD CONSTRAINT "project_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_admin_id_idx" ON "audit_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "audit_logs_target_user_id_idx" ON "audit_logs" USING btree ("target_user_id");