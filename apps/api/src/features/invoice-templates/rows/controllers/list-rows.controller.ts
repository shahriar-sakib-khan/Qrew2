import {
  db,
  invoiceTemplates,
  templateRowCharges,
  templateRows,
  templateSections,
} from "@starter/db";
import { and, asc, eq } from "drizzle-orm";
import { Context } from "hono";
import { getTemplateFormulaContext } from "../../services/template-formula-context.service";

export async function listRows(c: Context) {
  const sectionId = c.req.param("sectionId") as string;
  const templateId = c.req.param("templateId") as string;
  const organizationId = c.get("organizationId");
  if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

  // Verify ownership
  const secCheck = await db
    .select({ id: templateSections.id })
    .from(templateSections)
    .innerJoin(invoiceTemplates, eq(templateSections.templateId, invoiceTemplates.id))
    .where(
      and(eq(templateSections.id, sectionId), eq(invoiceTemplates.organizationId, organizationId)),
    )
    .limit(1);
  if (secCheck.length === 0) return c.json({ error: "Section not found" }, 404);

  const context = await getTemplateFormulaContext(templateId, organizationId);

  const rows = await db.query.templateRows.findMany({
    where: eq(templateRows.sectionId, sectionId),
    orderBy: [asc(templateRows.sortOrder)],
    with: {
      charges: { orderBy: [asc(templateRowCharges.sortOrder)] },
    },
  });

  // Decode formulas before sending to frontend
  const decoded = rows.map((row) => ({
    ...row,
    formula: context.decode(row.formula),
    charges: row.charges.map((ch) => ({
      ...ch,
      formula: context.decode(ch.formula) ?? ch.formula,
    })),
  }));

  return c.json({ rows: decoded, rowIndex: context.rowIdToToken });
}
