import { pgTable, text, timestamp, decimal, pgEnum } from "drizzle-orm/pg-core";
import { organizations, users } from "./auth";

export const transactionTypeEnum = pgEnum("wallet_transaction_type", [
  "credit", // Money given to staff
  "debit",  // Expense recorded
  "adjustment", // Manual adjustment
]);

export const referenceTypeEnum = pgEnum("wallet_reference_type", [
  "requisition",
  "expense",
  "manual",
]);

export const walletTransactions = pgTable("wallet_transactions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }), // The staff whose wallet this affects
  type: transactionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  referenceType: referenceTypeEnum("reference_type").notNull(),
  referenceId: text("reference_id"), // Links to requisitions.id or expenses.id
  description: text("description"), // E.g., "Disbursed funds for Req-123"
  createdAt: timestamp("created_at", { mode: 'date' }).defaultNow().notNull(),
});

export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type NewWalletTransaction = typeof walletTransactions.$inferInsert;
