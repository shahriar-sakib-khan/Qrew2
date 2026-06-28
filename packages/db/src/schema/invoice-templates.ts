import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  index,
  unique,
  AnyPgColumn,
  numeric,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, users } from "./auth";
import {
  documentTypeEnum,
  templateScopeEnum,
  headerFieldTypeEnum,
  componentValueTypeEnum,
  sectionChargeBaseEnum,
} from "./invoice-enums";

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────
export const invoiceTemplates = pgTable(
  "invoice_templates",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    documentType: documentTypeEnum("document_type").default("general").notNull(),
    scope: templateScopeEnum("scope").default("organization").notNull(),
    currency: text("currency").default("USD").notNull(),
    version: integer("version").default(1).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sourceTemplateId: text("source_template_id").references(
      (): AnyPgColumn => invoiceTemplates.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("invoice_templates_org_scope_archived_idx").on(
      t.organizationId,
      t.scope,
      t.isArchived
    ),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE SECTIONS
// Each template has ordered sections (A, B, C… or custom named).
// sectionToken is frozen after creation and used in SEC_X_BASE/TOTAL/CHARGES tokens.
// ─────────────────────────────────────────────────────────────────────────────
export const templateSections = pgTable(
  "template_sections",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => invoiceTemplates.id, { onDelete: "cascade" }),
    /** Optional custom name. If null, the UI auto-displays the letter (A, B, C…). */
    displayName: text("display_name"),
    /** Optional description / notes shown below the section name. */
    description: text("description"),
    /** Frozen after creation. Drives SEC_<TOKEN>_BASE / _TOTAL / _CHARGES tokens. */
    sectionToken: text("section_token").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("template_section_token_unique").on(t.templateId, t.sectionToken),
    index("template_sections_template_sort_idx").on(t.templateId, t.sortOrder),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE ROWS  (parent container — no longer stores value/formula itself)
//
// Token contract:
//   rowToken            → the BASE sum of all sub-components (no charges)
//   rowToken + "_TOTAL" → base + sum of row charges  (derived at eval time)
// ─────────────────────────────────────────────────────────────────────────────
export const templateRows = pgTable(
  "template_rows",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => invoiceTemplates.id, { onDelete: "cascade" }),
    sectionId: text("section_id")
      .notNull()
      .references(() => templateSections.id, { onDelete: "cascade" }),
    /** Label shown in the section card as the group heading (e.g. "PORT DUES & FEES"). */
    parentLabel: text("parent_label").notNull(),
    /**
     * Globally unique per template. Short form — no section prefix.
     * e.g. PORT_DUES, AGENCY_FEE
     * Drives tokens: PORT_DUES (base sum) and PORT_DUES_TOTAL (base + charges)
     */
    rowToken: text("row_token").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    /** Optional description shown in the label column beneath the row label. */
    description: text("description"),
    /** normal = manual entry / formula = engine-computed */
    valueType: componentValueTypeEnum("value_type").notNull().default("normal"),
    /** 
     * Bare expression using {{$row:UUID}} references.
     * Decoded to token names before engine evaluation.
     * Only present when valueType = 'formula'.
     */
    formula: text("formula"),
    /** Pre-fill value for manual entry rows. Stored as numeric string. */
    initialValue: numeric("initial_value", { precision: 20, scale: 6 }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("template_row_token_unique").on(t.templateId, t.rowToken),
    index("template_rows_template_section_sort_idx").on(
      t.templateId,
      t.sectionId,
      t.sortOrder
    ),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE ROW COMPONENTS
// The individual value lines inside a parent row.
// Each gets its own token: <ROW_TOKEN>_<COMPONENT_LABEL_SNAKECASE>
// ─────────────────────────────────────────────────────────────────────────────
export const templateRowComponents = pgTable(
  "template_row_components",
  {
    id: text("id").primaryKey(),
    rowId: text("row_id")
      .notNull()
      .references(() => templateRows.id, { onDelete: "cascade" }),
    /** Display label for this component (e.g. "Arrival tug", "Port dues"). */
    label: text("label").notNull(),
    /** Column 2: calculation detail. Supports {{TOKEN}} and ${{TOKEN}} interpolation. */
    subDescription: text("sub_description"),
    /** Column 3: tariff note / authority. */
    qualifier: text("qualifier"),
    /** Tag slugs selected from invoice_tag_options. */
    tags: text("tags").array(),
    /**
     * Globally unique per template. Format: <ROW_TOKEN>_<LABEL_SNAKECASE>
     * e.g. PORT_DUES_ARRIVAL
     * Duplicate component labels within a row are rejected.
     */
    componentToken: text("component_token").notNull(),
    /** normal = manual entry with optional initialValue; formula = engine-computed. */
    valueType: componentValueTypeEnum("value_type").notNull().default("normal"),
    /** Bare token expression (no delimiters). Only present when valueType = formula. */
    formula: text("formula"),
    /** Pre-fill value shown to staff. Only for valueType = normal. */
    initialValue: numeric("initial_value", { precision: 20, scale: 6 }),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("template_row_component_token_unique").on(t.rowId, t.componentToken),
    index("template_row_components_row_sort_idx").on(t.rowId, t.sortOrder),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE ROW CHARGES
// Computed additions bound to a parent row (e.g. VAT 15% on PORT_DUES).
// formula: bare expression using the parent rowToken as base.
//   e.g.  "PORT_DUES * 0.15"
// chargeToken: <ROW_TOKEN>_<CHARGE_LABEL_SNAKECASE>
//   e.g.  PORT_DUES_VAT_15
// ─────────────────────────────────────────────────────────────────────────────
export const templateRowCharges = pgTable(
  "template_row_charges",
  {
    id: text("id").primaryKey(),
    rowId: text("row_id")
      .notNull()
      .references(() => templateRows.id, { onDelete: "cascade" }),
    /** Display label for this charge (e.g. "MANDATORY 15% VAT"). */
    label: text("label").notNull(),
    subDescription: text("sub_description"),
    qualifier: text("qualifier"),
    tags: text("tags").array(),
    /** Auto-generated: <ROW_TOKEN>_<LABEL_SNAKECASE>. Globally unique per template. */
    chargeToken: text("charge_token").notNull(),
    /**
     * Bare token expression. Must reference the parent rowToken as its primary operand.
     * e.g. "PORT_DUES * 0.15"
     * Scope restriction: may ONLY reference the parent row's tokens (rowToken,
     * componentTokens). Cross-row references are a validation error.
     */
    formula: text("formula").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("template_row_charge_token_unique").on(t.rowId, t.chargeToken),
    index("template_row_charges_row_sort_idx").on(t.rowId, t.sortOrder),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE SECTION CHARGES
// Computed additions bound to a section (e.g. 10% levy on all port costs).
// The full formula at eval time: SEC_<SECTION_TOKEN>_<formulaBase> <formulaRest>
//   e.g.  formulaBase = 'BASE', formulaRest = '* 0.10'
//   → evaluates as: SEC_A_BASE * 0.10
// ─────────────────────────────────────────────────────────────────────────────
export const templateSectionCharges = pgTable(
  "template_section_charges",
  {
    id: text("id").primaryKey(),
    sectionId: text("section_id")
      .notNull()
      .references(() => templateSections.id, { onDelete: "cascade" }),
    templateId: text("template_id")
      .notNull()
      .references(() => invoiceTemplates.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    subDescription: text("sub_description"),
    qualifier: text("qualifier"),
    tags: text("tags").array(),
    /** Auto-generated: SEC_<SECTION_TOKEN>_<LABEL_SNAKECASE>. */
    chargeToken: text("charge_token").notNull(),
    /** Which section aggregate acts as the base operand for this charge. */
    formulaBase: sectionChargeBaseEnum("formula_base").notNull(),
    /** The remainder of the expression after the base token. e.g. "* 0.10" or "* 0.15 + 50". */
    formulaRest: text("formula_rest").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("template_section_charge_token_unique").on(
      t.sectionId,
      t.chargeToken
    ),
    index("template_section_charges_section_sort_idx").on(
      t.sectionId,
      t.sortOrder
    ),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE HEADER FIELDS
// Fields shown above the table (vessel name, cargo, GRT, etc.)
// ─────────────────────────────────────────────────────────────────────────────
export const templateHeaderFields = pgTable(
  "template_header_fields",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => invoiceTemplates.id, { onDelete: "cascade" }),
    fieldType: headerFieldTypeEnum("field_type").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    columnPosition: text("column_position").default("left").notNull(),
    fileFieldKey: text("file_field_key"),
    isFormulaInjectable: boolean("is_formula_injectable")
      .default(false)
      .notNull(),
    orgConfigKey: text("org_config_key"),
    defaultManualValue: text("default_manual_value"),
    placeholder: text("placeholder"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("template_header_fields_template_sort_idx").on(
      t.templateId,
      t.sortOrder
    ),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE TAG OPTIONS
// Organization-level tag vocabulary for row/charge label qualifiers.
// e.g. "AS PER PORT TARIFF", "AS PER AGREEMENT"
// ─────────────────────────────────────────────────────────────────────────────
export const invoiceTagOptions = pgTable(
  "invoice_tag_options",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    value: text("value").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    unique("invoice_tag_options_org_value_unique").on(
      t.organizationId,
      t.value
    ),
    index("invoice_tag_options_org_idx").on(t.organizationId),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONS
// ─────────────────────────────────────────────────────────────────────────────
export const invoiceTemplatesRelations = relations(
  invoiceTemplates,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [invoiceTemplates.organizationId],
      references: [organizations.id],
    }),
    createdByUser: one(users, {
      fields: [invoiceTemplates.createdByUserId],
      references: [users.id],
    }),
    sourceTemplate: one(invoiceTemplates, {
      fields: [invoiceTemplates.sourceTemplateId],
      references: [invoiceTemplates.id],
      relationName: "source_template",
    }),
    derivedTemplates: many(invoiceTemplates, {
      relationName: "source_template",
    }),
    sections: many(templateSections),
    rows: many(templateRows),
    sectionCharges: many(templateSectionCharges),
    headerFields: many(templateHeaderFields),
  })
);

export const templateSectionsRelations = relations(
  templateSections,
  ({ one, many }) => ({
    template: one(invoiceTemplates, {
      fields: [templateSections.templateId],
      references: [invoiceTemplates.id],
    }),
    rows: many(templateRows),
    sectionCharges: many(templateSectionCharges),
  })
);

export const templateRowsRelations = relations(
  templateRows,
  ({ one, many }) => ({
    template: one(invoiceTemplates, {
      fields: [templateRows.templateId],
      references: [invoiceTemplates.id],
    }),
    section: one(templateSections, {
      fields: [templateRows.sectionId],
      references: [templateSections.id],
    }),
    charges: many(templateRowCharges),
  })
);

export const templateRowComponentsRelations = relations(
  templateRowComponents,
  ({ one }) => ({
    row: one(templateRows, {
      fields: [templateRowComponents.rowId],
      references: [templateRows.id],
    }),
  })
);

export const templateRowChargesRelations = relations(
  templateRowCharges,
  ({ one }) => ({
    row: one(templateRows, {
      fields: [templateRowCharges.rowId],
      references: [templateRows.id],
    }),
  })
);

export const templateSectionChargesRelations = relations(
  templateSectionCharges,
  ({ one }) => ({
    section: one(templateSections, {
      fields: [templateSectionCharges.sectionId],
      references: [templateSections.id],
    }),
    template: one(invoiceTemplates, {
      fields: [templateSectionCharges.templateId],
      references: [invoiceTemplates.id],
    }),
  })
);

export const templateHeaderFieldsRelations = relations(
  templateHeaderFields,
  ({ one }) => ({
    template: one(invoiceTemplates, {
      fields: [templateHeaderFields.templateId],
      references: [invoiceTemplates.id],
    }),
  })
);

export const invoiceTagOptionsRelations = relations(
  invoiceTagOptions,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [invoiceTagOptions.organizationId],
      references: [organizations.id],
    }),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type InvoiceTemplate = typeof invoiceTemplates.$inferSelect;
export type NewInvoiceTemplate = typeof invoiceTemplates.$inferInsert;

export type TemplateSection = typeof templateSections.$inferSelect;
export type NewTemplateSection = typeof templateSections.$inferInsert;

export type TemplateRow = typeof templateRows.$inferSelect;
export type NewTemplateRow = typeof templateRows.$inferInsert;

export type TemplateRowComponent = typeof templateRowComponents.$inferSelect;
export type NewTemplateRowComponent = typeof templateRowComponents.$inferInsert;

export type TemplateRowCharge = typeof templateRowCharges.$inferSelect;
export type NewTemplateRowCharge = typeof templateRowCharges.$inferInsert;

export type TemplateSectionCharge = typeof templateSectionCharges.$inferSelect;
export type NewTemplateSectionCharge =
  typeof templateSectionCharges.$inferInsert;

export type TemplateHeaderField = typeof templateHeaderFields.$inferSelect;
export type NewTemplateHeaderField = typeof templateHeaderFields.$inferInsert;

export type InvoiceTagOption = typeof invoiceTagOptions.$inferSelect;
export type NewInvoiceTagOption = typeof invoiceTagOptions.$inferInsert;
