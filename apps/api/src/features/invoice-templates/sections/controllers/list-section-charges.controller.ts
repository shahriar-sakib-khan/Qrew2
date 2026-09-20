import {
  db,
  decodeFormula,
  invoiceTemplates,
  templateSectionCharges,
  templateSections,
} from "@starter/db";
import { and, asc, eq } from "drizzle-orm";
import { Context } from "hono";
import { buildConstantIndex } from "../../metadata/services/constant-index.service";
import { buildRowIndex } from "../../rows/services/row-index.service";
import { buildSectionIndex } from "../services/section-index.service";

export async function listSectionCharges(c: Context) {
  const sectionId = c.req.param("sectionId") as string;
  const organizationId = c.get("organizationId");
  if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

  const secCheck = await db
    .select({ id: templateSections.id, templateId: templateSections.templateId })
    .from(templateSections)
    .innerJoin(invoiceTemplates, eq(templateSections.templateId, invoiceTemplates.id))
    .where(
      and(eq(templateSections.id, sectionId), eq(invoiceTemplates.organizationId, organizationId)),
    )
    .limit(1);
  if (secCheck.length === 0) return c.json({ error: "Section not found" }, 404);

  const templateId = secCheck[0].templateId;
  const { idToToken } = await buildRowIndex(templateId);
  const { idToToken: secIdToToken } = await buildSectionIndex(templateId);
  const { tplIdToToken } = await buildConstantIndex(templateId);

  const charges = await db
    .select({ charge: templateSectionCharges })
    .from(templateSectionCharges)
    .innerJoin(templateSections, eq(templateSectionCharges.sectionId, templateSections.id))
    .where(eq(templateSections.id, sectionId))
    .orderBy(asc(templateSectionCharges.sortOrder));

  const decoded = charges.map((row) => ({
    ...row.charge,
    formula: decodeFormula(row.charge.formula, idToToken, secIdToToken, tplIdToToken),
  }));

  return c.json(decoded);
}
