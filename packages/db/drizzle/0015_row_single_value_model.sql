-- Migration: Row Single-Value Model
-- Adds description, value_type, formula, and initial_value columns to template_rows.
-- The component_value_type_enum already exists (used by template_row_components).

ALTER TABLE "template_rows" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "template_rows" ADD COLUMN IF NOT EXISTS "value_type" "component_value_type_enum" NOT NULL DEFAULT 'normal';
ALTER TABLE "template_rows" ADD COLUMN IF NOT EXISTS "formula" text;
ALTER TABLE "template_rows" ADD COLUMN IF NOT EXISTS "initial_value" numeric(20, 6);
