import { Hono } from "hono";
import { requireAuth } from "../../infra/middleware/auth";
import { requireOrgPermission } from "../../infra/middleware/require-permission";
import * as expenseCategoriesController from "./expense-categories.controller";

const router = new Hono();

router.use("*", requireAuth);

router.post(
  "/",
  requireOrgPermission("finance:manage_categories"),
  expenseCategoriesController.createCategory
);

router.get(
  "/",
  expenseCategoriesController.listCategories
);

router.delete(
  "/:id",
  requireOrgPermission("finance:manage_categories"),
  expenseCategoriesController.deleteCategory
);

export { router as expenseCategoriesRouter };
