import { Hono } from "hono";
import { requireOrgPermission } from "../../infra/middleware/require-permission";
import { ProductsController } from "./products.controller";

export const productsRouter = new Hono();

productsRouter.get("/", requireOrgPermission("inventory:view_products"), ProductsController.list);
productsRouter.get(
  "/:id",
  requireOrgPermission("inventory:view_products"),
  ProductsController.getById,
);
productsRouter.post(
  "/",
  requireOrgPermission("inventory:create_product"),
  ProductsController.create,
);
productsRouter.put(
  "/:id",
  requireOrgPermission("inventory:edit_product"),
  ProductsController.update,
);
productsRouter.delete(
  "/:id",
  requireOrgPermission("inventory:delete_product"),
  ProductsController.remove,
);
