import { Hono } from "hono";
import { requireAuth } from "../../infra/middleware/auth";
import { UsersController } from "./users.controller";

const usersRouter = new Hono();

usersRouter.use("*", requireAuth);

usersRouter.post("/verify-password", UsersController.verifyPassword);
usersRouter.post("/me/otp", UsersController.sendDeleteOtp);
usersRouter.delete("/me", UsersController.deleteMe);

export { usersRouter };
