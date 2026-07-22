import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { organizations } from "./auth";
import { relations } from "drizzle-orm";

export const projectStatuses = pgTable("project_statuses", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),

  // Visual color for the status badge / workflow card (hex string, e.g. "#3b82f6")
  color: text("color").notNull().default("#6b7280"),

  order: integer("order").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  isSystem: boolean("is_system").notNull().default(false),

  // Workflow graph node classification
  // isInitial: true  → this is a valid entry point of the workflow (starting node)
  // isTerminal: true → this is a final/end node (Completed, Rejected, Cancelled, etc.)
  //                    Terminal nodes cannot have outgoing transitions.
  isInitial: boolean("is_initial").notNull().default(false),
  isTerminal: boolean("is_terminal").notNull().default(false),

  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

// Relations are kept minimal here to avoid circular imports with the
// project_status_transitions and project_status_fields tables.
// Use those tables directly for graph traversal queries.
export const projectStatusesRelations = relations(projectStatuses, ({ one }) => ({
  organization: one(organizations, {
    fields: [projectStatuses.organizationId],
    references: [organizations.id],
  }),
}));

export type ProjectStatus = typeof projectStatuses.$inferSelect;
export type NewProjectStatus = typeof projectStatuses.$inferInsert;
