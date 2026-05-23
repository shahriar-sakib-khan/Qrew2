import { pgTable, text, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { organizations } from "./auth";
import { clients } from "./clients";

export const projectStatusEnum = pgEnum("project_status", ["pending", "active", "completed", "canceled", "archived"]);

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: projectStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  customFields: jsonb("custom_fields").$type<Record<string, any>>().default({}),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
