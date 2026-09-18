/**
 * customers.ts
 * Buyers who purchase products from the organization.
 *
 * WHY a separate table from clients:
 * The existing `clients` table is reused as "Supplier" for purchases.
 * Customers are a distinct concept (buyers of our products), so a new table
 * prevents confusion and keeps the data model clean.
 */

import { pgTable, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { organizations } from "./auth";
import { relations } from "drizzle-orm";
import { sales } from "./sales";

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),

  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),

  isActive: boolean("is_active").default(true).notNull(),

  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}, (table) => [
  index("customers_org_idx").on(table.organizationId),
]);

export const customersRelations = relations(customers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [customers.organizationId],
    references: [organizations.id],
  }),
  sales: many(sales),
}));

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
