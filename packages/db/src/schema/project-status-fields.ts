/**
 * project_status_fields — Stage-Specific Field Mapping (Many-to-Many Junction)
 *
 * Maps custom field definitions to specific workflow status nodes.
 * A single field (e.g., "Discharge Date") can appear in multiple stages.
 *
 * Two independent flags control how/when a field relates to a stage:
 *
 * isVisibleInStage (Scenario B):
 *   When true, this field APPEARS and becomes editable once a file enters
 *   this stage. Fields not mapped to the current stage are shown as locked
 *   (🔒) in the file table and hidden from the edit form.
 *
 * isRequiredToEnter (Scenario A):
 *   When true, the user MUST fill in this field before the system will allow
 *   the file to transition INTO this stage. The pre-transition modal will
 *   collect all such required fields before advancing the status.
 *
 * Both flags can be true simultaneously:
 *   e.g., "Container Number" must be provided before entering "In Port" stage
 *   AND is shown/editable while the file remains in "In Port" stage.
 */
import { pgTable, text, timestamp, boolean, unique } from "drizzle-orm/pg-core";
import { organizations } from "./auth";
import { projectStatuses } from "./project-statuses";
import { customFieldDefinitions } from "./custom_fields";
import { relations } from "drizzle-orm";

export const projectStatusFields = pgTable("project_status_fields", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  statusId: text("status_id")
    .notNull()
    .references(() => projectStatuses.id, { onDelete: "cascade" }),
  fieldId: text("field_id")
    .notNull()
    .references(() => customFieldDefinitions.id, { onDelete: "cascade" }),

  // Scenario A: Must fill this field BEFORE the file can be advanced TO this stage
  isRequiredToEnter: boolean("is_required_to_enter").notNull().default(false),
  // Scenario B: Field becomes visible/active AFTER the file enters this stage
  isVisibleInStage: boolean("is_visible_in_stage").notNull().default(true),

  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  // Only one mapping row per (status, field) pair
  unique("status_field_unique").on(table.statusId, table.fieldId),
]);

export const projectStatusFieldsRelations = relations(projectStatusFields, ({ one }) => ({
  status: one(projectStatuses, {
    fields: [projectStatusFields.statusId],
    references: [projectStatuses.id],
  }),
  field: one(customFieldDefinitions, {
    fields: [projectStatusFields.fieldId],
    references: [customFieldDefinitions.id],
  }),
}));

export type ProjectStatusField = typeof projectStatusFields.$inferSelect;
export type NewProjectStatusField = typeof projectStatusFields.$inferInsert;
