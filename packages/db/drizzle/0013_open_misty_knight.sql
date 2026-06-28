ALTER TABLE "invoice_line_items" DROP CONSTRAINT "invoice_line_items_expense_id_expenses_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "client_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "status" SET DATA TYPE invoice_status_enum;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD COLUMN "token_key" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "file_sequence_number" integer;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "section_token" text;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "section_name" text;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "row_token" text NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "row_type" "row_type_enum" NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "label" text NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "sub_description" text;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "surcharge_label" text;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "qualifier" text;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "formula_snapshot" text;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "surcharge_formula_snapshot" text;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "sub_components_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "base_value" numeric(20, 6) NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "surcharge_value" numeric(20, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "total_value" numeric(20, 6) NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "computation_currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "is_visible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "display_order" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "document_type" "document_type_enum" NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "document_number" text NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "source_template_id" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "source_template_version" integer;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "generated_by_user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "issued_to_client_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "total_base_amount" numeric(20, 6) NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "total_surcharge_amount" numeric(20, 6) NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "grand_total_amount" numeric(20, 6) NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "historical_format" jsonb;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "resolved_scope" jsonb;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "resolved_header_values" jsonb;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "schema_version" text DEFAULT '1.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "frozen_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "issued_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "due_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "paid_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "voided_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_source_template_id_invoice_templates_id_fk" FOREIGN KEY ("source_template_id") REFERENCES "public"."invoice_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_generated_by_user_id_users_id_fk" FOREIGN KEY ("generated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_line_items_invoice_order_idx" ON "invoice_line_items" USING btree ("invoice_id","display_order");--> statement-breakpoint
CREATE INDEX "invoices_org_status_idx" ON "invoices" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "invoices_org_project_idx" ON "invoices" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE INDEX "invoices_org_created_idx" ON "invoices" USING btree ("organization_id","created_at");--> statement-breakpoint
ALTER TABLE "invoice_line_items" DROP COLUMN "expense_id";--> statement-breakpoint
ALTER TABLE "invoice_line_items" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "invoice_line_items" DROP COLUMN "quantity";--> statement-breakpoint
ALTER TABLE "invoice_line_items" DROP COLUMN "unit_price";--> statement-breakpoint
ALTER TABLE "invoice_line_items" DROP COLUMN "amount";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "invoice_number";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "issue_date";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "due_date";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "subtotal";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "tax_amount";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "total_amount";--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_category_token_unique" UNIQUE("organization_id","token_key");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_org_docnum_unique" UNIQUE("organization_id","document_number");--> statement-breakpoint
DROP TYPE "public"."invoice_status";