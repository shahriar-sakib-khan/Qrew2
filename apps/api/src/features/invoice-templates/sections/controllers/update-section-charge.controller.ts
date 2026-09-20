import { Context } from "hono";
import {
  db,
  templateSectionCharges,
  templateSections,
  invoiceTemplates,
  encodeFormula,
  decodeFormula,
} from "@starter/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { buildRowIndex } from "../../rows/services/row-index.service";
import { buildSectionIndex } from "../services/section-index.service";
import { buildConstantIndex } from "../../metadata/services/constant-index.service";
import { validateFormulaChars } from "../../validation/formula-validator";
import * as math from "mathjs";

function validateFormula(formula: string): boolean {
  try {
    math.parse(formula);
    return true;
  } catch {
    return false;
  }
}

const updateSectionChargeSchema = z.object({
  chargeToken: z.string().optional(),
  label: z.string().min(1).optional(),
  subDescription: z.string().optional().nullable(),
  qualifier: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  formula: z.string().min(1).optional(),
  orderIndex: z.number().int().min(0).optional(),
});

export async function updateSectionCharge(c: Context) {
  const chargeId = c.req.param("chargeId") as string;
  const organizationId = c.get("organizationId");
  if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

  const chargeCheck = await db
    .select({ charge: templateSectionCharges, section: templateSections })
    .from(templateSectionCharges)
    .innerJoin(templateSections, eq(templateSectionCharges.sectionId, templateSections.id))
    .innerJoin(invoiceTemplates, eq(templateSections.templateId, invoiceTemplates.id))
    .where(
      and(
        eq(templateSectionCharges.id, chargeId),
        eq(invoiceTemplates.organizationId, organizationId)
      )
    )
    .limit(1);

  if (chargeCheck.length === 0) return c.json({ error: "Section charge not found" }, 404);

  const body = await c.req.json();
  const parsed = updateSectionChargeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error }, 400);

  const existing = chargeCheck[0].charge;
  const templateId = chargeCheck[0].section.templateId;

  let encodedFormula = undefined;
  if (parsed.data.formula !== undefined) {
    const { tokenToId: rowTokenToId } = await buildRowIndex(templateId);
    const { tokenToId: secTokenToId } = await buildSectionIndex(templateId);
    const { tplTokenToId } = await buildConstantIndex(templateId);
    encodedFormula = encodeFormula(parsed.data.formula, rowTokenToId, secTokenToId, tplTokenToId) ?? parsed.data.formula;
  }

  const nextFormula = encodedFormula ?? existing.formula;
  if (!validateFormula(nextFormula)) {
    return c.json({ error: `Invalid formula syntax: "${nextFormula}"` }, 422);
  }
  
  if (parsed.data.formula !== undefined) {
    const charVal = validateFormulaChars(parsed.data.formula, parsed.data.chargeToken ?? existing.chargeToken);
    if (!charVal.valid) {
      return c.json({ error: charVal.error }, 422);
    }
  }

  const [updated] = await db
    .update(templateSectionCharges)
    .set({
      ...(parsed.data.chargeToken !== undefined && { chargeToken: parsed.data.chargeToken }),
      ...(parsed.data.label !== undefined && { label: parsed.data.label }),
      ...(parsed.data.subDescription !== undefined && { subDescription: parsed.data.subDescription }),
      ...(parsed.data.qualifier !== undefined && { qualifier: parsed.data.qualifier }),
      ...(parsed.data.tags !== undefined && { tags: parsed.data.tags }),
      ...(encodedFormula !== undefined && { formula: encodedFormula }),
      ...(parsed.data.orderIndex !== undefined && { sortOrder: parsed.data.orderIndex }),
    })
    .where(eq(templateSectionCharges.id, chargeId))
    .returning();

  const { idToToken: decodedIdToToken } = await buildRowIndex(templateId);
  const { idToToken: decodedSecIdToToken } = await buildSectionIndex(templateId);
  const { tplIdToToken: decodedTplIdToToken } = await buildConstantIndex(templateId);

  return c.json({
    ...updated,
    formula: decodeFormula(updated.formula, decodedIdToToken, decodedSecIdToToken, decodedTplIdToToken) ?? updated.formula,
  });
}
