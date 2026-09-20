import {
  db,
  decodeFormula,
  encodeFormula,
  invoiceTemplates,
  templateRowCharges,
  templateRows,
} from "@starter/db";
import { and, eq } from "drizzle-orm";
import { Context } from "hono";
import { z } from "zod";
import { validateTemplateDag } from "../../../invoices/engine/engine-utils";
import { getTemplateFormulaContext } from "../../services/template-formula-context.service";
import {
  validateFormulaChars,
  validateRateChargeFormula,
} from "../../validation/formula-validator";

function validateFormula(formula: string | null | undefined): boolean {
  if (!formula || !formula.trim()) return false;
  if (/[+\-*/]\s*$/.test(formula.trim())) return false;
  if (/^\s*[+*/]/.test(formula.trim())) return false;
  return true;
}

const updateRowChargeSchema = z.object({
  chargeToken: z
    .string()
    .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/, "chargeToken must be UPPER_SNAKE_CASE")
    .optional(),
  label: z.string().min(1).optional(),
  subDescription: z.string().optional().nullable(),
  qualifier: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  formula: z.string().optional(),
  orderIndex: z.number().int().min(0).optional(),
});

export async function updateCharge(c: Context) {
  const chargeId = c.req.param("chargeId") as string;
  const organizationId = c.get("organizationId");
  if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

  const chargeCheck = await db
    .select({ charge: templateRowCharges, row: templateRows })
    .from(templateRowCharges)
    .innerJoin(templateRows, eq(templateRowCharges.rowId, templateRows.id))
    .innerJoin(invoiceTemplates, eq(templateRows.templateId, invoiceTemplates.id))
    .where(
      and(eq(templateRowCharges.id, chargeId), eq(invoiceTemplates.organizationId, organizationId)),
    )
    .limit(1);
  if (chargeCheck.length === 0) return c.json({ error: "Row charge not found" }, 404);

  const body = await c.req.json();
  const parsed = updateRowChargeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error }, 400);

  const existing = chargeCheck[0].charge;
  const templateId = chargeCheck[0].row.templateId;

  const context = await getTemplateFormulaContext(templateId, organizationId);
  let encodedFormula: string | undefined;

  if (parsed.data.formula !== undefined) {
    encodedFormula = context.encode(parsed.data.formula) ?? parsed.data.formula;
  }

  if (parsed.data.formula !== undefined) {
    const rateVal = validateRateChargeFormula(parsed.data.formula, chargeCheck[0].row.rowToken);
    if (!rateVal.valid) {
      return c.json({ error: rateVal.error }, 422);
    }
    const charVal = validateFormulaChars(
      parsed.data.formula,
      parsed.data.chargeToken ?? existing.chargeToken,
    );
    if (!charVal.valid) {
      return c.json({ error: charVal.error }, 422);
    }
  }

  if (parsed.data.chargeToken && parsed.data.chargeToken !== existing.chargeToken) {
    const dup = await db.query.templateRowCharges.findFirst({
      where: and(
        eq(templateRowCharges.rowId, existing.rowId),
        eq(templateRowCharges.chargeToken, parsed.data.chargeToken),
      ),
    });
    if (dup) {
      return c.json(
        { error: `Row charge token "${parsed.data.chargeToken}" already exists on this row.` },
        409,
      );
    }
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(templateRowCharges)
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
        .where(eq(templateRowCharges.id, chargeId))
        .returning();

      if (encodedFormula !== undefined || parsed.data.chargeToken !== undefined) {
        const validation = await validateTemplateDag(templateId, tx);
        if (!validation.valid) {
          throw new Error(`DAG_ERROR:${validation.errors[0].message}`);
        }
      }

      return {
        ...updated,
        formula: context.decode(updated.formula) ?? updated.formula,
      };
    });

    return c.json(result);
  } catch (error: any) {
    if (error.message?.startsWith("DAG_ERROR:")) {
      return c.json({ error: error.message.replace("DAG_ERROR:", "") }, 422);
    }
    throw error;
  }
}
