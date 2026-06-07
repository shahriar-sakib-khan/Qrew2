import { pgTable, text, timestamp, decimal } from "drizzle-orm/pg-core";
import { organizations, users } from "./auth";
import { projects } from "./projects";
import { expenseCategories } from "./expense_categories";

export const expenses = pgTable("expenses", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }), // The user who spent the money
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "set null" }), // Optional project link
  categoryId: text("category_id")
    .notNull()
    .references(() => expenseCategories.id, { onDelete: "restrict" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  receiptUrl: text("receipt_url"),
  createdAt: timestamp("created_at", { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: 'date' }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
