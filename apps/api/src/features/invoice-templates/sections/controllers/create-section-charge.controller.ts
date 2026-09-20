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

function toSnakeCase(label: string): string {
  return label
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function validateFormula(formula: string): boolean {
  try {
    math.parse(formula);
    return true;
  } catch {
    return false;
  }
}

const createSectionChargeSchema = z.object({
  chargeToken: z.string().optional(),
  label: z.string().min(1),
  subDescription: z.string().optional().nullable(),
  qualifier: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  formula: z.string().min(1, "Formula is required"),
  orderIndex: z.number().int().min(0).default(0),
});

export async function createSectionCharge(c: Context) {
  const sectionId = c.req.param("sectionId") as string;
  const templateId = c.req.param("templateId") as string;
  const organizationId = c.get("organizationId");
  if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

  const secResult = await db
    .select({ section: templateSections })
    .from(templateSections)
    .innerJoin(invoiceTemplates, eq(templateSections.templateId, invoiceTemplates.id))
    .where(
      and(eq(templateSections.id, sectionId), eq(invoiceTemplates.organizationId, organizationId)),
    )
    .limit(1);
  if (secResult.length === 0) return c.json({ error: "Section not found" }, 404);

  const sectionToken = secResult[0].section.sectionToken;

  const body = await c.req.json();
  const parsed = createSectionChargeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error }, 400);

  const chargeToken =
    parsed.data.chargeToken ?? `SEC_${sectionToken}_${toSnakeCase(parsed.data.label)}`;

  if (!validateFormula(parsed.data.formula)) {
    return c.json({ error: `Invalid formula syntax: "${parsed.data.formula}"` }, 422);
  }
  const charVal = validateFormulaChars(parsed.data.formula, chargeToken);
  if (!charVal.valid) {
    return c.json({ error: charVal.error }, 422);
  }

  const dup = await db.query.templateSectionCharges.findFirst({
    where: and(
      eq(templateSectionCharges.sectionId, sectionId),
      eq(templateSectionCharges.chargeToken, chargeToken),
    ),
  });
  if (dup) {
    return c.json(
      { error: `Section charge token "${chargeToken}" already exists in this section.` },
      409,
    );
  }

  const context = await getTemplateFormulaContext(templateId, organizationId);

  const [newCharge] = await db
    .insert(templateSectionCharges)
    .values({
      id: crypto.randomUUID(),
      sectionId,
      templateId,
      label: parsed.data.label,
      subDescription: parsed.data.subDescription ?? null,
      qualifier: parsed.data.qualifier ?? null,
      tags: parsed.data.tags ?? [],
      chargeToken,
      formula: context.encode(parsed.data.formula) ?? parsed.data.formula,
      sortOrder: parsed.data.orderIndex,
    })
    .returning();

  return c.json(
    {
      ...newCharge,
      formula: context.decode(newCharge.formula) ?? newCharge.formula,
    },
    201,
  );
}
