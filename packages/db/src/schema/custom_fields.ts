import { pgTable, text, timestamp, boolean, pgEnum, jsonb, unique } from "drizzle-orm/pg-core";
import { organizations } from "./auth";
import { relations } from "drizzle-orm";

export const entityTypeEnum = pgEnum("entity_type", ["client", "project", "staff"]);
export const customFieldTypeEnum = pgEnum("custom_field_type", [
  "text", "number", "date", "boolean", "single_select", "multi_select", "others"
]);

export const customFieldDefinitions = pgTable("custom_field_definitions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  entityType: entityTypeEnum("entity_type").notNull(),

  // NOTE: projectStatusId has been removed. Field-to-stage mapping is now handled via
  // the `project_status_fields` junction table (Many-to-Many), allowing a single
  // field definition to be assigned to multiple workflow stages.

  fieldName: text("field_name").notNull(), // e.g., "Tax ID"
  fieldKey: text("field_key").notNull(),   // e.g., "TAX_ID" (always uppercase, set server-side)
  fieldType: customFieldTypeEnum("field_type").notNull(),
  isRequired: boolean("is_required").notNull().default(false),  // Cat 1 & 2: overall required flag
  options: jsonb("options").$type<string[]>(),  // Array of options for single_select / multi_select types

  // Category 1 & 2: Visibility configuration (used by Customize Fields page)
  isDetailed: boolean("is_detailed").notNull().default(false),
  isSensitive: boolean("is_sensitive").notNull().default(false),

  // Category 3 (Private Fields): When true, this field is completely hidden from all
  // users except org owner and super admins. It does NOT appear in the table column
  // dropdown, file forms, or any shared view regardless of workflow state.
  isPrivate: boolean("is_private").notNull().default(false),

  isSeeded: boolean("is_seeded").notNull().default(false), // Indicates this was created by the system setup
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}, (table) => [
  unique("custom_field_org_entity_key_unique").on(table.organizationId, table.entityType, table.fieldKey)
]);

// Relations defined without back-references to avoid circular imports.
// Use `projectStatusFields` table directly for status↔field queries.
export const customFieldDefinitionsRelations = relations(customFieldDefinitions, ({ one }) => ({
  organization: one(organizations, {
    fields: [customFieldDefinitions.organizationId],
    references: [organizations.id],
  }),
}));

export type CustomFieldDefinition = typeof customFieldDefinitions.$inferSelect;
export type NewCustomFieldDefinition = typeof customFieldDefinitions.$inferInsert;
