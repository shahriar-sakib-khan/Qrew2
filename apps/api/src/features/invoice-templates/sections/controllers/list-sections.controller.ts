import {
  db,
  invoiceTemplates,
  templateRowCharges,
  templateRows,
  templateSectionCharges,
  templateSections,
} from "@starter/db";
import { and, asc, eq } from "drizzle-orm";
import { Context } from "hono";
import { getTemplateFormulaContext } from "../../services/template-formula-context.service";

export async function listSections(c: Context) {
  const templateId = c.req.param("templateId") as string;
  const organizationId = c.get("organizationId");
  if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

  const template = await db.query.invoiceTemplates.findFirst({
    where: and(
      eq(invoiceTemplates.id, templateId),
      eq(invoiceTemplates.organizationId, organizationId),
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

  const context = await getTemplateFormulaContext(templateId, organizationId);

  const decodedSections = sections.map((sec) => ({
    ...sec,
    rows: (sec.rows || []).map((row) => ({
      ...row,
      formula: context.decode(row.formula),
      charges: (row.charges || []).map((ch) => ({
        ...ch,
        formula: context.decode(ch.formula) ?? ch.formula,
      })),
    })),
    sectionCharges: (sec.sectionCharges || []).map((sc) => ({
      ...sc,
      formula: context.decode(sc.formula) ?? sc.formula,
    })),
  }));

  return c.json(decodedSections);
}
