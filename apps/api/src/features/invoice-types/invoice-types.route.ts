import { Hono } from "hono";
import { InvoiceTypesController } from "./invoice-types.controller";
import { requireOrgPermission } from "../../infra/middleware/require-permission";

export const invoiceTypesRouter = new Hono();

invoiceTypesRouter.get(
  "/",
  requireOrgPermission("workspace:manage_fields"),
  InvoiceTypesController.listTypes
);

invoiceTypesRouter.post(
  "/",
  requireOrgPermission("workspace:manage_fields"),
  InvoiceTypesController.createType
);

invoiceTypesRouter.patch(
  "/:id",
  requireOrgPermission("workspace:manage_fields"),
  InvoiceTypesController.updateType
);

invoiceTypesRouter.delete(
  "/:id",
  requireOrgPermission("workspace:manage_fields"),
  InvoiceTypesController.deleteType
);
