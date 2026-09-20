-- 0002_brands.sql
-- Adds the brands master table and migrates products.brand (string) → products.brand_id (FK).
--
-- WHY manual migration instead of drizzle-kit generate:
-- The existing DB has schema drift from the previous fix-migrations workaround.
-- We apply changes directly to avoid conflicting with the snapshot metadata.

-- Step 1: Create the brands table.
CREATE TABLE IF NOT EXISTS "brands" (
  "id"              TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name"            TEXT NOT NULL,
  "is_active"       BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Unique brand name per org.
CREATE UNIQUE INDEX IF NOT EXISTS "brands_org_name_unique"
  ON "brands" ("organization_id", "name");

-- Fast lookup of active brands per org.
CREATE INDEX IF NOT EXISTS "brands_org_active_idx"
  ON "brands" ("organization_id", "is_active");

-- Step 2: Add brand_id FK column to products (nullable, SET NULL on brand delete).
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "brand_id" TEXT
  REFERENCES "brands"("id") ON DELETE SET NULL;

-- Index for brand-based product queries.
CREATE INDEX IF NOT EXISTS "products_org_brand_idx"
  ON "products" ("organization_id", "brand_id");

-- Step 3: Drop the old plain-text brand column.
-- We do this AFTER adding brand_id so the migration is reversible if brand_id fails.
ALTER TABLE "products"
  DROP COLUMN IF EXISTS "brand";
