import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { configValueTypeEnum } from "./invoice-enums";
import { invoiceTemplates } from "./invoice-templates";

export const templateConstants = pgTable(
  "template_constants",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => invoiceTemplates.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    token: text("token").notNull(),
    valueType: configValueTypeEnum("value_type").notNull().default("number"),
    defaultValue: text("default_value"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique("template_constants_template_token_unique").on(t.templateId, t.token)],
);

export const templateConstantsRelations = relations(templateConstants, ({ one }) => ({
  template: one(invoiceTemplates, {
    fields: [templateConstants.templateId],
    references: [invoiceTemplates.id],
  }),
}));

export type TemplateConstant = typeof templateConstants.$inferSelect;
export type NewTemplateConstant = typeof templateConstants.$inferInsert;
