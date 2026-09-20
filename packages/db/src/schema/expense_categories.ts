import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organizations } from "./auth";
import { relations } from "drizzle-orm";

export const expenseCategories = pgTable("expense_categories", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  tokenKey: text("token_key"),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: 'date' }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  unique("expense_category_token_unique").on(table.organizationId, table.tokenKey),
]);

export const expenseCategoriesRelations = relations(expenseCategories, ({ one }) => ({
  organization: one(organizations, {
    fields: [expenseCategories.organizationId],
    references: [organizations.id],
  }),
}));

export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type NewExpenseCategory = typeof expenseCategories.$inferInsert;
