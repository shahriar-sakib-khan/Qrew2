import { Hono } from "hono";
import { requireOrgPermission } from "../../infra/middleware/require-permission";
import { InvoiceTemplatesController } from "./invoice-templates.controller";

import { listSections } from "./sections/controllers/list-sections.controller";
import { createSection } from "./sections/controllers/create-section.controller";
import { updateSection } from "./sections/controllers/update-section.controller";
import { deleteSection } from "./sections/controllers/delete-section.controller";

import { listRows } from "./rows/controllers/list-rows.controller";
import { createRow } from "./rows/controllers/create-row.controller";
import { updateRow } from "./rows/controllers/update-row.controller";
import { deleteRow } from "./rows/controllers/delete-row.controller";
import { reorderRows } from "./rows/controllers/reorder-rows.controller";

import { listCharges as listRowCharges } from "./rows/controllers/list-row-charges.controller";
import { createCharge as createRowCharge } from "./rows/controllers/create-row-charge.controller";
import { updateCharge as updateRowCharge } from "./rows/controllers/update-row-charge.controller";
import { deleteCharge as deleteRowCharge, reorderCharges as reorderRowCharges } from "./rows/controllers/manage-row-charge.controller";

import { listSectionCharges } from "./sections/controllers/list-section-charges.controller";
import { createSectionCharge } from "./sections/controllers/create-section-charge.controller";
import { updateSectionCharge } from "./sections/controllers/update-section-charge.controller";
import { deleteSectionCharge, reorderSectionCharges } from "./sections/controllers/manage-section-charge.controller";

import { listConstants } from "./metadata/controllers/list-constants.controller";
import { createConstant } from "./metadata/controllers/create-constant.controller";
import { updateConstant } from "./metadata/controllers/update-constant.controller";
import { deleteConstant } from "./metadata/controllers/delete-constant.controller";

import { TemplateHeaderFieldsController } from "./metadata/template-header-fields.controller";

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

invoiceTemplatesRouter.patch(
  "/:templateId/header-fields/:fieldId",
  requireOrgPermission("finance:manage_invoices"),
  TemplateHeaderFieldsController.updateHeaderField
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
  listSections
);

invoiceTemplatesRouter.post(
  "/:templateId/sections",
  requireOrgPermission("finance:manage_invoices"),
  createSection
);

invoiceTemplatesRouter.patch(
  "/:templateId/sections/:sectionId",
  requireOrgPermission("finance:manage_invoices"),
  updateSection
);

invoiceTemplatesRouter.delete(
  "/:templateId/sections/:sectionId",
  requireOrgPermission("finance:manage_invoices"),
  deleteSection
);

// ── Rows ──────────────────────────────────────────────────────────────────────
invoiceTemplatesRouter.get(
  "/:templateId/sections/:sectionId/rows",
  requireOrgPermission("finance:view_invoices"),
  listRows
);

invoiceTemplatesRouter.post(
  "/:templateId/sections/:sectionId/rows",
  requireOrgPermission("finance:manage_invoices"),
  createRow
);

invoiceTemplatesRouter.patch(
  "/:templateId/sections/:sectionId/rows/:rowId",
  requireOrgPermission("finance:manage_invoices"),
  updateRow
);

invoiceTemplatesRouter.put(
  "/:templateId/sections/:sectionId/rows/reorder",
  requireOrgPermission("finance:manage_invoices"),
  reorderRows
);

invoiceTemplatesRouter.delete(
  "/:templateId/sections/:sectionId/rows/:rowId",
  requireOrgPermission("finance:manage_invoices"),
  deleteRow
);

// ── Row Charges ───────────────────────────────────────────────────────────────
invoiceTemplatesRouter.put(
  "/:templateId/sections/:sectionId/rows/:rowId/charges/reorder",
  requireOrgPermission("finance:manage_invoices"),
  reorderRowCharges
);

invoiceTemplatesRouter.get(
  "/:templateId/sections/:sectionId/rows/:rowId/charges",
  requireOrgPermission("finance:view_invoices"),
  listRowCharges
);

invoiceTemplatesRouter.post(
  "/:templateId/sections/:sectionId/rows/:rowId/charges",
  requireOrgPermission("finance:manage_invoices"),
  createRowCharge
);

invoiceTemplatesRouter.patch(
  "/:templateId/sections/:sectionId/rows/:rowId/charges/:chargeId",
  requireOrgPermission("finance:manage_invoices"),
  updateRowCharge
);

invoiceTemplatesRouter.delete(
  "/:templateId/sections/:sectionId/rows/:rowId/charges/:chargeId",
  requireOrgPermission("finance:manage_invoices"),
  deleteRowCharge
);


// ── Section Charges ───────────────────────────────────────────────────────────
invoiceTemplatesRouter.put(
  "/:templateId/sections/:sectionId/section-charges/reorder",
  requireOrgPermission("finance:manage_invoices"),
  reorderSectionCharges
);

invoiceTemplatesRouter.get(
  "/:templateId/sections/:sectionId/section-charges",
  requireOrgPermission("finance:view_invoices"),
  listSectionCharges
);

invoiceTemplatesRouter.post(
  "/:templateId/sections/:sectionId/section-charges",
  requireOrgPermission("finance:manage_invoices"),
  createSectionCharge
);

invoiceTemplatesRouter.patch(
  "/:templateId/sections/:sectionId/section-charges/:chargeId",
  requireOrgPermission("finance:manage_invoices"),
  updateSectionCharge
);

invoiceTemplatesRouter.delete(
  "/:templateId/sections/:sectionId/section-charges/:chargeId",
  requireOrgPermission("finance:manage_invoices"),
  deleteSectionCharge
);

// ── Template Constants ────────────────────────────────────────────────────────
invoiceTemplatesRouter.get(
  "/:templateId/constants",
  requireOrgPermission("finance:view_invoices"),
  listConstants
);

invoiceTemplatesRouter.post(
  "/:templateId/constants",
  requireOrgPermission("finance:manage_invoices"),
  createConstant
);

invoiceTemplatesRouter.patch(
  "/:templateId/constants/:constantId",
  requireOrgPermission("finance:manage_invoices"),
  updateConstant
);

invoiceTemplatesRouter.delete(
  "/:templateId/constants/:constantId",
  requireOrgPermission("finance:manage_invoices"),
  deleteConstant
);
