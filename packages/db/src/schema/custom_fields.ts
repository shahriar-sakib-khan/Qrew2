import { pgTable, text, timestamp, boolean, pgEnum, jsonb, unique } from "drizzle-orm/pg-core";
import { organizations } from "./auth";
import { projectStatuses } from "./project-statuses";

export const entityTypeEnum = pgEnum("entity_type", ["client", "project", "staff"]);
export const customFieldTypeEnum = pgEnum("custom_field_type", ["text", "number", "date", "boolean", "single_select", "multi_select", "others"]);

export const customFieldDefinitions = pgTable("custom_field_definitions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  entityType: entityTypeEnum("entity_type").notNull(),
  projectStatusId: text("project_status_id")
    .references(() => projectStatuses.id, { onDelete: "cascade" }),
  fieldName: text("field_name").notNull(), // e.g., "Tax ID"
  fieldKey: text("field_key").notNull(), // e.g., "tax_id"
  fieldType: customFieldTypeEnum("field_type").notNull(),
  isRequired: boolean("is_required").notNull().default(false),
  options: jsonb("options").$type<string[]>(), // Array of options for select types
  isDetailed: boolean("is_detailed").notNull().default(false),
  isSensitive: boolean("is_sensitive").notNull().default(false),
  isSeeded: boolean("is_seeded").notNull().default(false), // Indicates this was created by the system setup
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}, (table) => [
  unique("custom_field_org_entity_key_unique").on(table.organizationId, table.entityType, table.fieldKey)
]);

export type CustomFieldDefinition = typeof customFieldDefinitions.$inferSelect;
export type NewCustomFieldDefinition = typeof customFieldDefinitions.$inferInsert;
