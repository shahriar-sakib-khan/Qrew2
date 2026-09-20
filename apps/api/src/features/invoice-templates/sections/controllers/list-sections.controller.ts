import { Context } from "hono";
import {
  db,
  templateSections,
  templateRows,
  templateSectionCharges,
  templateRowCharges,
  invoiceTemplates,
} from "@starter/db";
import { eq, and, asc } from "drizzle-orm";

export async function listSections(c: Context) {
  const templateId = c.req.param("templateId") as string;
  const organizationId = c.get("organizationId");
  if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

  const template = await db.query.invoiceTemplates.findFirst({
    where: and(
      eq(invoiceTemplates.id, templateId),
      eq(invoiceTemplates.organizationId, organizationId)
    ),
  });
  if (!template) return c.json({ error: "Template not found" }, 404);

  const sections = await db.query.templateSections.findMany({
    where: eq(templateSections.templateId, templateId),
    orderBy: [asc(templateSections.sortOrder)],
    with: {
      rows: {
        orderBy: [asc(templateRows.sortOrder)],
        with: {
          charges: {
            orderBy: [asc(templateRowCharges.sortOrder)],
          },
        },
      },
      sectionCharges: {
        orderBy: [asc(templateSectionCharges.sortOrder)],
      },
    },
  });

  return c.json(sections);
}
