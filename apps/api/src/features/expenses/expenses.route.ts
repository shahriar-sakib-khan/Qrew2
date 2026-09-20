import { Hono } from "hono";
import { requireAuth } from "../../infra/middleware/auth";
import * as expensesController from "./expenses.controller";

const router = new Hono();

router.use("*", requireAuth);

router.post(
  "/",
  expensesController.createExpense
);

router.get(
  "/",
  expensesController.listExpenses
);

export { router as expensesRouter };
