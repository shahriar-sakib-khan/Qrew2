import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { organizations, users } from "./auth";
import { projects } from "./projects";
import { relations } from "drizzle-orm";

export const projectAttachments = pgTable("project_attachments", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  uploadedBy: text("uploaded_by")
    .references(() => users.id, { onDelete: "set null" }),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: text("file_type").notNull(),
  fileUrl: text("file_url").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export type ProjectAttachment = typeof projectAttachments.$inferSelect;
export type NewProjectAttachment = typeof projectAttachments.$inferInsert;

export const projectAttachmentsRelations = relations(projectAttachments, ({ one }) => ({
  project: one(projects, {
    fields: [projectAttachments.projectId],
    references: [projects.id],
  }),
  uploader: one(users, {
    fields: [projectAttachments.uploadedBy],
    references: [users.id],
  }),
}));
