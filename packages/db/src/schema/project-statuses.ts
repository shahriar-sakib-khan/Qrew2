import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { organizations } from "./auth";
import { relations } from "drizzle-orm";

export const projectStatuses = pgTable("project_statuses", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  order: integer("order").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const projectStatusesRelations = relations(projectStatuses, ({ one }) => ({
  organization: one(organizations, {
    fields: [projectStatuses.organizationId],
    references: [organizations.id],
  }),
}));

export type ProjectStatus = typeof projectStatuses.$inferSelect;
export type NewProjectStatus = typeof projectStatuses.$inferInsert;
