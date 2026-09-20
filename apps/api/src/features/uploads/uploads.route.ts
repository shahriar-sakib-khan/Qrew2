import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../../infra/middleware/auth";
import { UploadsController } from "./uploads.controller";

const uploadsRouter = new Hono();

// Block unauthenticated access
uploadsRouter.use("*", requireAuth);

uploadsRouter.post(
  "/presigned-avatar",
  zValidator(
    "json",
    z.object({
      contentType: z.string(),
    }),
  ),
  UploadsController.getAvatarUploadUrl,
);

export { uploadsRouter };
