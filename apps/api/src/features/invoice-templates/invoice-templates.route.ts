import { Hono } from "hono";
import { requireOrgPermission } from "../../infra/middleware/require-permission";
import { InvoiceTemplatesController } from "./invoice-templates.controller";
import { TemplateSectionsController } from "./template-sections.controller";
import { TemplateRowsController } from "./template-rows.controller";
import { TemplateSectionChargesController } from "./template-section-charges.controller";
import { TemplateConstantsController } from "./template-constants.controller";

export const invoiceTemplatesRouter = new Hono();

// ── Templates ─────────────────────────────────────────────────────────────────
invoiceTemplatesRouter.get(
  "/",
  requireOrgPermission("finance:view_invoices"),
  InvoiceTemplatesController.listTemplates
);

invoiceTemplatesRouter.get(
  "/:id",
  requireOrgPermission("finance:view_invoices"),
  InvoiceTemplatesController.getTemplate
);

invoiceTemplatesRouter.post(
  "/",
  requireOrgPermission("finance:manage_invoices"),
  InvoiceTemplatesController.createTemplate
);

invoiceTemplatesRouter.patch(
  "/:id",
  requireOrgPermission("finance:manage_invoices"),
  InvoiceTemplatesController.updateTemplate
);

invoiceTemplatesRouter.delete(
  "/:id",
  requireOrgPermission("finance:manage_invoices"),
  InvoiceTemplatesController.deleteTemplate
);

// ── Header Fields ─────────────────────────────────────────────────────────────
import { TemplateHeaderFieldsController } from "./template-header-fields.controller";

invoiceTemplatesRouter.get(
  "/:templateId/header-fields",
  requireOrgPermission("finance:view_invoices"),
  TemplateHeaderFieldsController.listHeaderFields
);

invoiceTemplatesRouter.post(
  "/:templateId/header-fields",
  requireOrgPermission("finance:manage_invoices"),
  TemplateHeaderFieldsController.createHeaderField
);

invoiceTemplatesRouter.delete(
  "/:templateId/header-fields/:fieldId",
  requireOrgPermission("finance:manage_invoices"),
  TemplateHeaderFieldsController.deleteHeaderField
);

invoiceTemplatesRouter.put(
  "/:templateId/header-fields/reorder",
  requireOrgPermission("finance:manage_invoices"),
  TemplateHeaderFieldsController.reorderHeaderFields
);

// ── Sections ──────────────────────────────────────────────────────────────────
invoiceTemplatesRouter.get(
  "/:templateId/sections",
  requireOrgPermission("finance:view_invoices"),
  TemplateSectionsController.listSections
);

invoiceTemplatesRouter.post(
  "/:templateId/sections",
  requireOrgPermission("finance:manage_invoices"),
  TemplateSectionsController.createSection
);

invoiceTemplatesRouter.patch(
  "/:templateId/sections/:sectionId",
  requireOrgPermission("finance:manage_invoices"),
  TemplateSectionsController.updateSection
);

invoiceTemplatesRouter.delete(
  "/:templateId/sections/:sectionId",
  requireOrgPermission("finance:manage_invoices"),
  TemplateSectionsController.deleteSection
);

// ── Rows ──────────────────────────────────────────────────────────────────────
invoiceTemplatesRouter.get(
  "/:templateId/sections/:sectionId/rows",
  requireOrgPermission("finance:view_invoices"),
  TemplateRowsController.listRows
);

invoiceTemplatesRouter.post(
  "/:templateId/sections/:sectionId/rows",
  requireOrgPermission("finance:manage_invoices"),
  TemplateRowsController.createRow
);

invoiceTemplatesRouter.patch(
  "/:templateId/sections/:sectionId/rows/:rowId",
  requireOrgPermission("finance:manage_invoices"),
  TemplateRowsController.updateRow
);

// PUT /reorder — must be registered BEFORE /:rowId so "reorder" isn't treated as a rowId
invoiceTemplatesRouter.put(
  "/:templateId/sections/:sectionId/rows/reorder",
  requireOrgPermission("finance:manage_invoices"),
  TemplateRowsController.reorderRows
);

invoiceTemplatesRouter.delete(
  "/:templateId/sections/:sectionId/rows/:rowId",
  requireOrgPermission("finance:manage_invoices"),
  TemplateRowsController.deleteRow
);

// ── Section Charges ───────────────────────────────────────────────────────────
invoiceTemplatesRouter.get(
  "/:templateId/sections/:sectionId/section-charges",
  requireOrgPermission("finance:view_invoices"),
  TemplateSectionChargesController.listSectionCharges
);

invoiceTemplatesRouter.post(
  "/:templateId/sections/:sectionId/section-charges",
  requireOrgPermission("finance:manage_invoices"),
  TemplateSectionChargesController.createSectionCharge
);

invoiceTemplatesRouter.patch(
  "/:templateId/sections/:sectionId/section-charges/:chargeId",
  requireOrgPermission("finance:manage_invoices"),
  TemplateSectionChargesController.updateSectionCharge
);

invoiceTemplatesRouter.delete(
  "/:templateId/sections/:sectionId/section-charges/:chargeId",
  requireOrgPermission("finance:manage_invoices"),
  TemplateSectionChargesController.deleteSectionCharge
);

// ── Template Constants ────────────────────────────────────────────────────────
invoiceTemplatesRouter.get(
  "/:templateId/constants",
  requireOrgPermission("finance:view_invoices"),
  TemplateConstantsController.listConstants
);

invoiceTemplatesRouter.post(
  "/:templateId/constants",
  requireOrgPermission("finance:manage_invoices"),
  TemplateConstantsController.createConstant
);

invoiceTemplatesRouter.patch(
  "/:templateId/constants/:constantId",
  requireOrgPermission("finance:manage_invoices"),
  TemplateConstantsController.updateConstant
);

invoiceTemplatesRouter.delete(
  "/:templateId/constants/:constantId",
  requireOrgPermission("finance:manage_invoices"),
  TemplateConstantsController.deleteConstant
);
