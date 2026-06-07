import { pgTable, text, timestamp, decimal, pgEnum } from "drizzle-orm/pg-core";
import { organizations, users } from "./auth";
import { projects } from "./projects";

export const requisitionStatusEnum = pgEnum("requisition_status", [
  "pending",
  "approved",
  "rejected",
  "disbursed",
]);

export const requisitions = pgTable("requisitions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  requestedById: text("requested_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "set null" }), // Optional project link
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  purpose: text("purpose").notNull(),
  status: requisitionStatusEnum("status").default("pending").notNull(),
  actionedById: text("actioned_by_id")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: 'date' }).defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Requisition = typeof requisitions.$inferSelect;
export type NewRequisition = typeof requisitions.$inferInsert;
