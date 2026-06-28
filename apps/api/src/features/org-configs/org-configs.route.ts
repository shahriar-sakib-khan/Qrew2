import { Hono } from "hono";
import { requireAuth } from "../../infra/middleware/auth";
import { requireOrgPermission } from "../../infra/middleware/require-permission";
import * as orgConfigsController from "./org-configs.controller";

const router = new Hono();

router.use("*", requireAuth);

router.post(
  "/",
  requireOrgPermission("finance:manage_invoices"),
  orgConfigsController.createConfig
);

router.get(
  "/",
  orgConfigsController.listConfigs
);

router.patch(
  "/:id",
  requireOrgPermission("finance:manage_invoices"),
  orgConfigsController.updateConfig
);

router.delete(
  "/:id",
  requireOrgPermission("finance:manage_invoices"),
  orgConfigsController.deleteConfig
);

export { router as orgConfigsRouter };
