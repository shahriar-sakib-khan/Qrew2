import { pgTable, text, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./auth";
import { clients } from "./clients";
import { projects } from "./projects";
import { expenses } from "./expenses";

export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "open", "paid", "void", "uncollectible"]);

export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  clientId: text("client_id")
    .references(() => clients.id, { onDelete: "set null" }),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "set null" }), // Optional: tied to a specific file/project
  invoiceNumber: text("invoice_number").notNull(),
  status: invoiceStatusEnum("status").default("draft").notNull(),
  issueDate: timestamp("issue_date", { mode: "date" }),
  dueDate: timestamp("due_date", { mode: "date" }),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default("0").notNull(),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  expenseId: text("expense_id")
    .references(() => expenses.id, { onDelete: "set null" }), // Optional link to an existing expense
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).default("1").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(), // quantity * unitPrice
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});
