/**
 * brands.ts
 * Brand master table for the inventory module.
 * Products reference brands via a FK so brand management is centralized per org.
 * Brands are soft-deletable via isActive rather than hard DELETE to preserve history.
 */

import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organizations } from "./auth";
import { products } from "./products";

export const brands = pgTable(
  "brands",
  {
    id: text("id").primaryKey(),

    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    name: text("name").notNull(),

    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Brand names must be unique within an org (case-sensitive at DB level).
    unique("brands_org_name_unique").on(table.organizationId, table.name),

    // Index for fast listing of active brands per org.
    index("brands_org_active_idx").on(table.organizationId, table.isActive),
  ],
);

export const brandsRelations = relations(brands, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [brands.organizationId],
    references: [organizations.id],
  }),
  // Products that belong to this brand.
  products: many(products),
}));

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
