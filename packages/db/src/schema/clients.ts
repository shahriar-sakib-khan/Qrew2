import { pgTable, text, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { organizations } from "./auth";

export const clientStatusEnum = pgEnum("client_status", ["active", "lead", "archived"]);

export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  status: clientStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  customFields: jsonb("custom_fields").$type<Record<string, any>>().default({}),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
