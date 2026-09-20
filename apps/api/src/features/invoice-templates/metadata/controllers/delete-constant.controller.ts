import { Context } from "hono";
import { db, templateConstants } from "@starter/db";
import { eq } from "drizzle-orm";

export async function deleteConstant(c: Context) {
  const id = c.req.param("constantId") as string;
  
  const [deleted] = await db
    .delete(templateConstants)
    .where(eq(templateConstants.id, id))
    .returning();

  if (!deleted) return c.json({ error: "Not found" }, 404);

  return c.json({ success: true });
}
