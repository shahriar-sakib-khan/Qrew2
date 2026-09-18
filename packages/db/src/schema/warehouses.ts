/**
 * warehouses.ts
 * Physical storage locations (branches, godowns, stores).
 * warehouseId is NULLABLE on purchases/sales in v1 — single-branch businesses
 * don't need to select a warehouse on every transaction.
 */

import { pgTable, text, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { organizations } from "./auth";
import { relations } from "drizzle-orm";
import { purchases } from "./purchases";
import { sales } from "./sales";
import { inventoryTransactions } from "./inventory-transactions";

export const warehouses = pgTable("warehouses", {
  id: text("id").primaryKey(),

  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),

  name: text("name").notNull(),

  // Short identifier, e.g. "WH-01", "MAIN". Optional.
  code: text("code"),

  address: text("address"),
  isActive: boolean("is_active").default(true).notNull(),

  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}, (table) => [
  // Warehouse codes must be unique per org (when provided).
  unique("warehouses_org_code_unique").on(table.organizationId, table.code),
]);

export const warehousesRelations = relations(warehouses, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [warehouses.organizationId],
    references: [organizations.id],
  }),
  purchases: many(purchases),
  sales: many(sales),
  transactions: many(inventoryTransactions),
}));

export type Warehouse = typeof warehouses.$inferSelect;
export type NewWarehouse = typeof warehouses.$inferInsert;
