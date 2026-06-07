import { Hono } from "hono";
import { InvoicesController } from "./invoices.controller";
import { requireAuth } from "../../infra/middleware/auth";
import { requireOrgPermission } from "../../infra/middleware/require-permission";

export const invoicesRouter = new Hono();

// Only logged in users can access these endpoints
invoicesRouter.use("*", requireAuth);

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

// Create invoice (requires finance:manage_invoices)
invoicesRouter.post(
  "/",
  requireOrgPermission("finance:manage_invoices"),
  InvoicesController.createInvoice
);

// Update status
invoicesRouter.post(
  "/:id/status",
  requireOrgPermission("finance:manage_invoices"),
  InvoicesController.updateStatus
);
