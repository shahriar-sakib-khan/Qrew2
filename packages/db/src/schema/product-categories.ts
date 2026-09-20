/**
 * product-categories.ts
 * Optional grouping for products (e.g., "Gas Cylinders", "Accessories").
 * Unique per org — two orgs can share category names without conflict.
 */

import { relations } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organizations } from "./auth";
import { products } from "./products";

export const productCategories = pgTable(
  "product_categories",
  {
    id: text("id").primaryKey(),

    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Prevent duplicate category names within the same org.
    unique("product_categories_org_name_unique").on(table.organizationId, table.name),
  ],
);

export const productCategoriesRelations = relations(productCategories, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [productCategories.organizationId],
    references: [organizations.id],
  }),
  products: many(products),
}));

export type ProductCategory = typeof productCategories.$inferSelect;
export type NewProductCategory = typeof productCategories.$inferInsert;
