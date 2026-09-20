import { Hono } from "hono";
import { requireAuth } from "../../infra/middleware/auth";
import * as walletController from "./wallet.controller";

const router = new Hono();

router.use("*", requireAuth);

router.get(
  "/balance",
  walletController.getWalletBalance
);

router.get(
  "/transactions",
  walletController.listTransactions
);

router.post(
  "/:memberId/adjust",
  walletController.addManualAdjustment
);

export { router as walletRouter };
