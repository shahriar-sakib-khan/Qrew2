import { pgTable, text, timestamp, pgEnum, jsonb, integer } from "drizzle-orm/pg-core";
import { organizations } from "./auth";
import { clients } from "./clients";
import { relations } from "drizzle-orm";
import { projectStatuses } from "./project-statuses";

export const projectLifecycleStateEnum = pgEnum("project_lifecycle_state", ["open", "completed", "canceled", "archived"]);

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").references(() => projectStatuses.id).notNull(),
  fileSequenceNumber: integer("file_sequence_number"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  customFields: jsonb("custom_fields").$type<Record<string, any>>().default({}),
  lifecycleState: projectLifecycleStateEnum("lifecycle_state").default("open").notNull(),
  archivedAt: timestamp("archived_at", { mode: "date" }),
});

export const projectsRelations = relations(projects, ({ one }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
  }),
  statusRelation: one(projectStatuses, {
    fields: [projects.status],
    references: [projectStatuses.id],
  }),
}));

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
