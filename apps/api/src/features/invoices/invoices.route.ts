import { Hono } from "hono";
import { InvoicesController } from "./invoices.controller";
import { DraftsController } from "./drafts.controller";
import { EngineController } from "./engine/engine.controller";
import { requireAuth } from "../../infra/middleware/auth";
import { requireOrgPermission } from "../../infra/middleware/require-permission";

export const invoicesRouter = new Hono();

// Only logged in users can access these endpoints
invoicesRouter.use("*", requireAuth);

// Get tokens for token bridge
invoicesRouter.get(
  "/tokens",
  requireOrgPermission("finance:view_invoices"),
  InvoicesController.getTokens
);

// Math engine preview
invoicesRouter.post(
  "/preview",
  requireOrgPermission("finance:manage_invoices"),
  EngineController.previewInvoice
);

// --- DRAFTS ---
invoicesRouter.get(
  "/drafts/list",
  requireOrgPermission("finance:manage_invoices"),
  DraftsController.listDrafts
);

invoicesRouter.get(
  "/drafts",
  requireOrgPermission("finance:manage_invoices"),
  DraftsController.getDraft
);

invoicesRouter.get(
  "/drafts/:id",
  requireOrgPermission("finance:manage_invoices"),
  DraftsController.getDraftById
);

invoicesRouter.post(
  "/drafts",
  requireOrgPermission("finance:manage_invoices"),
  DraftsController.createDraft
);

invoicesRouter.put(
  "/drafts",
  requireOrgPermission("finance:manage_invoices"),
  DraftsController.upsertDraft
);

invoicesRouter.delete(
  "/drafts/:id",
  requireOrgPermission("finance:manage_invoices"),
  DraftsController.deleteDraft
);

// --- GENERATION & MUTATION ---
invoicesRouter.post(
  "/generate",
  requireOrgPermission("finance:manage_invoices"),
  InvoicesController.generateInvoice
);

invoicesRouter.post(
  "/:id/issue",
  requireOrgPermission("finance:manage_invoices"),
  InvoicesController.issueInvoice
);

invoicesRouter.post(
  "/:id/void",
  requireOrgPermission("finance:manage_invoices"),
  InvoicesController.voidInvoice
);

// List invoices (requires finance:view_invoices)
invoicesRouter.get(
  "/",
  requireOrgPermission("finance:view_invoices"),
  InvoicesController.listInvoices
);

// Get single invoice
invoicesRouter.get(
  "/:id",
  requireOrgPermission("finance:view_invoices"),
  InvoicesController.getInvoice
);


