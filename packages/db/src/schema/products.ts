/**
 * products.ts
 * Master product catalog for the organization.
 * Stock levels are NOT stored here — they are always computed from inventory_transactions.
 * This table only holds the product definition (what it is, not how many).
 */

import { relations } from "drizzle-orm";
import { boolean, decimal, index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organizations } from "./auth";
import { brands } from "./brands";
import { productTypeEnum } from "./inventory-enums";
import { inventoryTransactions } from "./inventory-transactions";
import { productCategories } from "./product-categories";
import { purchaseItems } from "./purchases";
import { saleItems } from "./sales";

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),

    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Optional: product can exist without a category.
    categoryId: text("category_id").references(() => productCategories.id, {
      onDelete: "set null",
    }),

    // Optional: product can exist without a brand (FK, ON DELETE SET NULL).
    brandId: text("brand_id").references(() => brands.id, { onDelete: "set null" }),

    name: text("name").notNull(),

    // Nullable — not all products have a SKU. Uniqueness is per-org (see index below).
    sku: text("sku"),

    // Nullable — not all products have a barcode.
    barcode: text("barcode"),

    description: text("description"),

    // NORMAL = simple quantity tracking; REFILLABLE = tracked by FULL/EMPTY state separately.
    productType: productTypeEnum("product_type").default("NORMAL").notNull(),

    // Unit of measurement, e.g., "pcs", "kg", "liter", "cylinder".
    unit: text("unit").notNull(),

    // Purchase price paid to supplier; selling price charged to customer.
    purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
    sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }),

    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    /**
     * SKU and barcode uniqueness is per-org, not global.
     * Postgres treats two NULLs as distinct, so nullable columns don't collide —
     * two products with sku=NULL in the same org are fine.
     */
    unique("products_org_sku_unique").on(table.organizationId, table.sku),
    unique("products_org_barcode_unique").on(table.organizationId, table.barcode),

    // Common query: list all REFILLABLE products for an org.
    index("products_org_type_idx").on(table.organizationId, table.productType),
    index("products_org_category_idx").on(table.organizationId, table.categoryId),
    index("products_org_brand_idx").on(table.organizationId, table.brandId),
  ],
);

export const productsRelations = relations(products, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [products.organizationId],
    references: [organizations.id],
  }),
  category: one(productCategories, {
    fields: [products.categoryId],
    references: [productCategories.id],
  }),
  // Brand is optional; null means no brand assigned.
  brand: one(brands, {
    fields: [products.brandId],
    references: [brands.id],
  }),
  purchaseItems: many(purchaseItems),
  saleItems: many(saleItems),
  transactions: many(inventoryTransactions),
}));

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
