import { Hono } from "hono";
import { requireOrgPermission } from "../../infra/middleware/require-permission";
import { SalesController } from "./sales.controller";

export const salesRouter = new Hono();

salesRouter.get("/", requireOrgPermission("inventory:view_sales"), SalesController.list);
salesRouter.get("/:id", requireOrgPermission("inventory:view_sales"), SalesController.getById);
salesRouter.post("/", requireOrgPermission("inventory:create_sale"), SalesController.create);
salesRouter.put("/:id", requireOrgPermission("inventory:edit_sale"), SalesController.update);
salesRouter.delete("/:id", requireOrgPermission("inventory:delete_sale"), SalesController.remove);

// confirm and cancel are separate permissions because they write to the ledger.
salesRouter.patch(
  "/:id/confirm",
  requireOrgPermission("inventory:confirm_sale"),
  SalesController.confirm,
);
salesRouter.patch(
  "/:id/cancel",
  requireOrgPermission("inventory:cancel_sale"),
  SalesController.cancel,
);
