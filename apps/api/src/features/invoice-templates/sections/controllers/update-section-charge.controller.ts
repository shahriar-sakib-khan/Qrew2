import {
  db,
  decodeFormula,
  encodeFormula,
  invoiceTemplates,
  templateSectionCharges,
  templateSections,
} from "@starter/db";
import { and, eq } from "drizzle-orm";
import { Context } from "hono";
import * as math from "mathjs";
import { z } from "zod";
import { getTemplateFormulaContext } from "../../services/template-formula-context.service";
import { validateFormulaChars } from "../../validation/formula-validator";

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
        eq(invoiceTemplates.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (chargeCheck.length === 0) return c.json({ error: "Section charge not found" }, 404);

  const body = await c.req.json();
  const parsed = updateSectionChargeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error }, 400);

  const existing = chargeCheck[0].charge;
  const templateId = chargeCheck[0].section.templateId;

  const context = await getTemplateFormulaContext(templateId, organizationId);
  let encodedFormula;
  if (parsed.data.formula !== undefined) {
    encodedFormula = context.encode(parsed.data.formula) ?? parsed.data.formula;
  }

  const nextFormula = encodedFormula ?? existing.formula;
  if (!validateFormula(nextFormula)) {
    return c.json({ error: `Invalid formula syntax: "${nextFormula}"` }, 422);
  }

  if (parsed.data.formula !== undefined) {
    const charVal = validateFormulaChars(
      parsed.data.formula,
      parsed.data.chargeToken ?? existing.chargeToken,
    );
    if (!charVal.valid) {
      return c.json({ error: charVal.error }, 422);
    }
  }

  const [updated] = await db
    .update(templateSectionCharges)
    .set({
      ...(parsed.data.chargeToken !== undefined && { chargeToken: parsed.data.chargeToken }),
      ...(parsed.data.label !== undefined && { label: parsed.data.label }),
      ...(parsed.data.subDescription !== undefined && {
        subDescription: parsed.data.subDescription,
      }),
      ...(parsed.data.qualifier !== undefined && { qualifier: parsed.data.qualifier }),
      ...(parsed.data.tags !== undefined && { tags: parsed.data.tags }),
      ...(encodedFormula !== undefined && { formula: encodedFormula }),
      ...(parsed.data.orderIndex !== undefined && { sortOrder: parsed.data.orderIndex }),
    })
    .where(eq(templateSectionCharges.id, chargeId))
    .returning();

  return c.json({
    ...updated,
    formula: context.decode(updated.formula) ?? updated.formula,
  });
}
