CREATE TYPE "public"."component_value_type_enum" AS ENUM('normal', 'formula');--> statement-breakpoint
CREATE TYPE "public"."section_charge_base_enum" AS ENUM('BASE', 'TOTAL', 'CHARGES');--> statement-breakpoint
ALTER TYPE "public"."custom_field_type" ADD VALUE 'others';--> statement-breakpoint
CREATE TABLE "invoice_tag_options" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_tag_options_org_value_unique" UNIQUE("organization_id","value")
);
--> statement-breakpoint
CREATE TABLE "template_row_charges" (
	"id" text PRIMARY KEY NOT NULL,
	"row_id" text NOT NULL,
	"label" text NOT NULL,
	"sub_description" text,
	"qualifier" text,
	"tags" text[],
	"charge_token" text NOT NULL,
	"formula" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "template_row_charge_token_unique" UNIQUE("row_id","charge_token")
);
--> statement-breakpoint
CREATE TABLE "template_row_components" (
	"id" text PRIMARY KEY NOT NULL,
	"row_id" text NOT NULL,
	"label" text NOT NULL,
	"sub_description" text,
	"qualifier" text,
	"tags" text[],
	"component_token" text NOT NULL,
	"value_type" "component_value_type_enum" DEFAULT 'normal' NOT NULL,
	"formula" text,
	"initial_value" numeric(20, 6),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "template_row_component_token_unique" UNIQUE("row_id","component_token")
);
--> statement-breakpoint
CREATE TABLE "template_section_charges" (
	"id" text PRIMARY KEY NOT NULL,
	"section_id" text NOT NULL,
	"template_id" text NOT NULL,
	"label" text NOT NULL,
	"sub_description" text,
	"qualifier" text,
	"tags" text[],
	"charge_token" text NOT NULL,
	"formula_base" "section_charge_base_enum" NOT NULL,
	"formula_rest" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "template_section_charge_token_unique" UNIQUE("section_id","charge_token")
);
--> statement-breakpoint
ALTER TABLE "template_rows" DROP CONSTRAINT "template_rows_aggregate_target_section_id_template_sections_id_fk";
--> statement-breakpoint
ALTER TABLE "template_rows" ALTER COLUMN "section_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "section_display_name" text;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "line_type" text DEFAULT 'row' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "tags" text[];--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "components_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "charges_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "charges_value" numeric(20, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "total_charges_amount" numeric(20, 6) NOT NULL;--> statement-breakpoint
ALTER TABLE "template_rows" ADD COLUMN "parent_label" text NOT NULL;--> statement-breakpoint
ALTER TABLE "template_rows" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "template_rows" ADD COLUMN "value_type" "component_value_type_enum" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "template_rows" ADD COLUMN "formula" text;--> statement-breakpoint
ALTER TABLE "template_rows" ADD COLUMN "initial_value" numeric(20, 6);--> statement-breakpoint
ALTER TABLE "template_sections" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "template_sections" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "invoice_tag_options" ADD CONSTRAINT "invoice_tag_options_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_row_charges" ADD CONSTRAINT "template_row_charges_row_id_template_rows_id_fk" FOREIGN KEY ("row_id") REFERENCES "public"."template_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_row_components" ADD CONSTRAINT "template_row_components_row_id_template_rows_id_fk" FOREIGN KEY ("row_id") REFERENCES "public"."template_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_section_charges" ADD CONSTRAINT "template_section_charges_section_id_template_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."template_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_section_charges" ADD CONSTRAINT "template_section_charges_template_id_invoice_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."invoice_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_tag_options_org_idx" ON "invoice_tag_options" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "template_row_charges_row_sort_idx" ON "template_row_charges" USING btree ("row_id","sort_order");--> statement-breakpoint
CREATE INDEX "template_row_components_row_sort_idx" ON "template_row_components" USING btree ("row_id","sort_order");--> statement-breakpoint
CREATE INDEX "template_section_charges_section_sort_idx" ON "template_section_charges" USING btree ("section_id","sort_order");--> statement-breakpoint
ALTER TABLE "invoice_line_items" DROP COLUMN "section_name";--> statement-breakpoint
ALTER TABLE "invoice_line_items" DROP COLUMN "row_type";--> statement-breakpoint
ALTER TABLE "invoice_line_items" DROP COLUMN "surcharge_label";--> statement-breakpoint
ALTER TABLE "invoice_line_items" DROP COLUMN "surcharge_formula_snapshot";--> statement-breakpoint
ALTER TABLE "invoice_line_items" DROP COLUMN "sub_components_snapshot";--> statement-breakpoint
ALTER TABLE "invoice_line_items" DROP COLUMN "surcharge_value";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "total_surcharge_amount";--> statement-breakpoint
ALTER TABLE "template_rows" DROP COLUMN "row_type";--> statement-breakpoint
ALTER TABLE "template_rows" DROP COLUMN "label";--> statement-breakpoint
ALTER TABLE "template_rows" DROP COLUMN "sub_description";--> statement-breakpoint
ALTER TABLE "template_rows" DROP COLUMN "surcharge_label";--> statement-breakpoint
ALTER TABLE "template_rows" DROP COLUMN "qualifier";--> statement-breakpoint
ALTER TABLE "template_rows" DROP COLUMN "formula_raw";--> statement-breakpoint
ALTER TABLE "template_rows" DROP COLUMN "formula_ast";--> statement-breakpoint
ALTER TABLE "template_rows" DROP COLUMN "surcharge_formula";--> statement-breakpoint
ALTER TABLE "template_rows" DROP COLUMN "constant_value";--> statement-breakpoint
ALTER TABLE "template_rows" DROP COLUMN "default_value";--> statement-breakpoint
ALTER TABLE "template_rows" DROP COLUMN "is_default_overrideable";--> statement-breakpoint
ALTER TABLE "template_rows" DROP COLUMN "sub_components";--> statement-breakpoint
ALTER TABLE "template_rows" DROP COLUMN "aggregate_target_section_id";--> statement-breakpoint
ALTER TABLE "template_rows" DROP COLUMN "computation_currency";--> statement-breakpoint
ALTER TABLE "template_rows" DROP COLUMN "is_visible";--> statement-breakpoint
ALTER TABLE "template_sections" DROP COLUMN "name";--> statement-breakpoint
DROP TYPE "public"."row_type_enum";