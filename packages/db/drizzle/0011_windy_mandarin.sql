CREATE TABLE "template_rows" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"section_id" text,
	"row_token" text NOT NULL,
	"row_type" "row_type_enum" NOT NULL,
	"label" text NOT NULL,
	"sub_description" text,
	"surcharge_label" text,
	"qualifier" text,
	"formula_raw" text,
	"formula_ast" jsonb,
	"surcharge_formula" text,
	"constant_value" numeric(20, 6),
	"default_value" numeric(20, 6),
	"is_default_overrideable" boolean DEFAULT true NOT NULL,
	"sub_components" jsonb,
	"aggregate_target_section_id" text,
	"computation_currency" text DEFAULT 'USD' NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "template_row_token_unique" UNIQUE("template_id","row_token")
);
--> statement-breakpoint
ALTER TABLE "template_rows" ADD CONSTRAINT "template_rows_template_id_invoice_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."invoice_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_rows" ADD CONSTRAINT "template_rows_section_id_template_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."template_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_rows" ADD CONSTRAINT "template_rows_aggregate_target_section_id_template_sections_id_fk" FOREIGN KEY ("aggregate_target_section_id") REFERENCES "public"."template_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "template_rows_template_section_sort_idx" ON "template_rows" USING btree ("template_id","section_id","sort_order");