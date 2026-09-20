import { pgTable, text, timestamp, boolean, integer, jsonb, uniqueIndex, unique } from "drizzle-orm/pg-core";
import { organizations, users } from "./auth";
import { configValueTypeEnum } from "./invoice-enums";
import { relations } from "drizzle-orm";

export const organizationConfigs = pgTable(
  "organization_configs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    configKey: text("config_key").notNull(),
    configValue: text("config_value").notNull(),
    displayLabel: text("display_label").notNull(),
    valueType: configValueTypeEnum("value_type").notNull(),
    isFormulaInjectable: boolean("is_formula_injectable").default(false).notNull(),
    updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("org_config_key_unique").on(table.organizationId, table.configKey),
    unique("org_config_label_unique").on(table.organizationId, table.displayLabel),
  ]
);

export const invoicePdfLayouts = pgTable(
  "invoice_pdf_layouts",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" })
      .unique(),
    logoUrl: text("logo_url"),
    companyDisplayName: text("company_display_name"),
    companyTagline: text("company_tagline"),
    invoiceNumberFormat: text("invoice_number_format").default("{DOC_TYPE}-{FILE_SEQ}").notNull(),
    pdaPrefix: text("pda_prefix").default("PDA").notNull(),
    fdaPrefix: text("fda_prefix").default("FDA").notNull(),
    proformaPrefix: text("proforma_prefix").default("PRO").notNull(),
    generalPrefix: text("general_prefix").default("INV").notNull(),
    currentDocSequence: integer("current_doc_sequence").default(0).notNull(),
    defaultPaymentTerms: text("default_payment_terms"),
    bankDetails: jsonb("bank_details").$type<any>(),
    extraSections: jsonb("extra_sections").$type<any>().default([]).notNull(),
    footerBlocks: jsonb("footer_blocks").$type<any>().default([]).notNull(),
    showSubtotalColumn: boolean("show_subtotal_column").default(true).notNull(),
    detailColumnSeparator: text("detail_column_separator").default("newline").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  }
);

export const invoiceDocumentSequences = pgTable(
  "invoice_document_sequences",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" })
      .unique(),
    currentValue: integer("current_value").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  }
);

export const organizationConfigsRelations = relations(organizationConfigs, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationConfigs.organizationId],
    references: [organizations.id],
  }),
  updatedByUser: one(users, {
    fields: [organizationConfigs.updatedByUserId],
    references: [users.id],
  }),
}));

export const invoicePdfLayoutsRelations = relations(invoicePdfLayouts, ({ one }) => ({
  organization: one(organizations, {
    fields: [invoicePdfLayouts.organizationId],
    references: [organizations.id],
  }),
}));

export const invoiceDocumentSequencesRelations = relations(invoiceDocumentSequences, ({ one }) => ({
  organization: one(organizations, {
    fields: [invoiceDocumentSequences.organizationId],
    references: [organizations.id],
  }),
}));

export type OrganizationConfig = typeof organizationConfigs.$inferSelect;
export type NewOrganizationConfig = typeof organizationConfigs.$inferInsert;

export type InvoicePdfLayout = typeof invoicePdfLayouts.$inferSelect;
export type NewInvoicePdfLayout = typeof invoicePdfLayouts.$inferInsert;

export type InvoiceDocumentSequence = typeof invoiceDocumentSequences.$inferSelect;
export type NewInvoiceDocumentSequence = typeof invoiceDocumentSequences.$inferInsert;
