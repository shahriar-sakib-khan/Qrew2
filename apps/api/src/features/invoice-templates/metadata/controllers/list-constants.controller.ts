import { db, templateConstants } from "@starter/db";
import { eq } from "drizzle-orm";
import { Context } from "hono";

export async function listConstants(c: Context) {
  const templateId = c.req.param("templateId") as string;

  const constants = await db
    .select()
    .from(templateConstants)
    .where(eq(templateConstants.templateId, templateId));

  return c.json(constants);
}
