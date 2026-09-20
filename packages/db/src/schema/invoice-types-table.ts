import { pgTable, text, timestamp, boolean, unique } from "drizzle-orm/pg-core";
import { organizations } from "./auth";
import { relations } from "drizzle-orm";

export const invoiceTypes = pgTable("invoice_types", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: 'date' }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  unique("invoice_type_name_unique").on(table.organizationId, table.name),
]);

export const invoiceTypesRelations = relations(invoiceTypes, ({ one }) => ({
  organization: one(organizations, {
    fields: [invoiceTypes.organizationId],
    references: [organizations.id],
  }),
}));

export type InvoiceType = typeof invoiceTypes.$inferSelect;
export type NewInvoiceType = typeof invoiceTypes.$inferInsert;
