import { Context } from "hono";
import { db, templateRows, templateSections, invoiceTemplates } from "@starter/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

export async function reorderRows(c: Context) {
  const sectionId = c.req.param("sectionId") as string;
  const organizationId = c.get("organizationId");
  if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

  // Verify section ownership
  const secResult = await db
    .select({ section: templateSections })
    .from(templateSections)
    .innerJoin(invoiceTemplates, eq(templateSections.templateId, invoiceTemplates.id))
    .where(
      and(
        eq(templateSections.id, sectionId),
        eq(invoiceTemplates.organizationId, organizationId)
      )
    )
    .limit(1);
  if (secResult.length === 0) return c.json({ error: "Section not found" }, 404);

  const body = await c.req.json();
  const parsed = z.object({ orderedIds: z.array(z.string().uuid()) }).safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error }, 400);

  const { orderedIds } = parsed.data;

  // Bulk-update every row's sortOrder to its position in the list
  await db.transaction(async (tx) => {
    await Promise.all(
      orderedIds.map((id, index) =>
        tx
          .update(templateRows)
          .set({ sortOrder: index })
          .where(
            and(
              eq(templateRows.id, id),
              eq(templateRows.sectionId, sectionId)
            )
          )
      )
    );
  });

  return c.json({ success: true });
}
