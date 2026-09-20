import { Hono } from "hono";
import { requireOrgPermission } from "../../infra/middleware/require-permission";
import { PurchasesController } from "./purchases.controller";

export const purchasesRouter = new Hono();

purchasesRouter.get(
  "/",
  requireOrgPermission("inventory:view_purchases"),
  PurchasesController.list,
);
purchasesRouter.get(
  "/:id",
  requireOrgPermission("inventory:view_purchases"),
  PurchasesController.getById,
);
purchasesRouter.post(
  "/",
  requireOrgPermission("inventory:create_purchase"),
  PurchasesController.create,
);
purchasesRouter.put(
  "/:id",
  requireOrgPermission("inventory:edit_purchase"),
  PurchasesController.update,
);
purchasesRouter.delete(
  "/:id",
  requireOrgPermission("inventory:delete_purchase"),
  PurchasesController.remove,
);

// Status transition endpoints — these write to the ledger so they need specific permissions.
purchasesRouter.patch(
  "/:id/confirm",
  requireOrgPermission("inventory:confirm_purchase"),
  PurchasesController.confirm,
);
purchasesRouter.patch(
  "/:id/cancel",
  requireOrgPermission("inventory:cancel_purchase"),
  PurchasesController.cancel,
);
