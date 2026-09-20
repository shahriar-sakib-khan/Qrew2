import { Context } from "hono";
import { db, templateRows, invoiceTemplates } from "@starter/db";
import { eq, and } from "drizzle-orm";

export async function deleteRow(c: Context) {
  const rowId = c.req.param("rowId") as string;
  const organizationId = c.get("organizationId");
  if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

  const rowCheck = await db
    .select({ id: templateRows.id })
    .from(templateRows)
    .innerJoin(invoiceTemplates, eq(templateRows.templateId, invoiceTemplates.id))
    .where(and(eq(templateRows.id, rowId), eq(invoiceTemplates.organizationId, organizationId)))
    .limit(1);

  if (rowCheck.length === 0) return c.json({ error: "Row not found" }, 404);

  // Charges delete via FK CASCADE
  await db.delete(templateRows).where(eq(templateRows.id, rowId));

  return c.json({ success: true });
}
