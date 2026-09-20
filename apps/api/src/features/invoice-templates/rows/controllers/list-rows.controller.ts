import { Context } from "hono";
import {
  db,
  templateRows,
  templateRowCharges,
  templateSections,
  invoiceTemplates,
  decodeFormula,
} from "@starter/db";
import { buildRowIndex } from "../services/row-index.service";
import { buildSectionIndex } from "../../sections/services/section-index.service";
import { buildConstantIndex } from "../../metadata/services/constant-index.service";
import { eq, and, asc } from "drizzle-orm";

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
      and(
        eq(templateSections.id, sectionId),
        eq(invoiceTemplates.organizationId, organizationId)
      )
    )
    .limit(1);
  if (secCheck.length === 0) return c.json({ error: "Section not found" }, 404);

  // Build id->token maps for formula decoding
  const { idToToken } = await buildRowIndex(templateId);
  const { idToToken: secIdToToken } = await buildSectionIndex(templateId);
  const { tplIdToToken } = await buildConstantIndex(templateId);

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
    formula: decodeFormula(row.formula, idToToken, secIdToToken, tplIdToToken),
    charges: row.charges.map((ch) => ({
      ...ch,
      formula: decodeFormula(ch.formula, idToToken, secIdToToken, tplIdToToken) ?? ch.formula,
    })),
  }));

  return c.json({ rows: decoded, rowIndex: idToToken });
}
