import {
  db,
  invoiceTemplates,
  templateRows,
  templateSectionCharges,
  templateSections,
} from "@starter/db";
import { and, eq } from "drizzle-orm";
import { Context } from "hono";
import { z } from "zod";
import { getTemplateFormulaContext } from "../../services/template-formula-context.service";

const updateSectionSchema = z.object({
  label: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  sectionToken: z
    .string()
    .min(1)
    .regex(/^[A-Z0-9_]+$/, "sectionToken must be UPPER_SNAKE_CASE")
    .optional()
    .nullable(),
  orderIndex: z.number().int().min(0).optional(),
});

export async function updateSection(c: Context) {
  const sectionId = c.req.param("sectionId") as string;
  const organizationId = c.get("organizationId");
  if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

  const sectionRow = await db
    .select({ section: templateSections, org: invoiceTemplates.organizationId })
    .from(templateSections)
    .innerJoin(invoiceTemplates, eq(templateSections.templateId, invoiceTemplates.id))
    .where(
      and(eq(templateSections.id, sectionId), eq(invoiceTemplates.organizationId, organizationId)),
    )
    .limit(1);

  if (sectionRow.length === 0) return c.json({ error: "Section not found" }, 404);

  const body = await c.req.json();
  const parsed = updateSectionSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error }, 400);

  const updateData: Partial<typeof templateSections.$inferInsert> = {};
  if (
    parsed.data.sectionToken !== undefined &&
    parsed.data.sectionToken !== sectionRow[0].section.sectionToken
  ) {
    if (!parsed.data.sectionToken) {
      return c.json({ error: "sectionToken cannot be empty" }, 400);
    }
    const collision = await db.query.templateSections.findFirst({
      where: and(
        eq(templateSections.templateId, sectionRow[0].section.templateId),
        eq(templateSections.sectionToken, parsed.data.sectionToken),
      ),
    });
    if (collision) {
      return c.json(
        {
          error: `Section token "${parsed.data.sectionToken}" is already in use in this template.`,
        },
        409,
      );
    }
    updateData.sectionToken = parsed.data.sectionToken;
  }

  if (parsed.data.label !== undefined) updateData.label = parsed.data.label ?? null;
  if (parsed.data.description !== undefined)
    updateData.description = parsed.data.description ?? null;
  if (parsed.data.orderIndex !== undefined) updateData.sortOrder = parsed.data.orderIndex;

  let updated;
  await db.transaction(async (tx) => {
    [updated] = await tx
      .update(templateSections)
      .set(updateData)
      .where(eq(templateSections.id, sectionId))
      .returning();

    if (updateData.sectionToken) {
      const templateId = sectionRow[0].section.templateId;
      const context = await getTemplateFormulaContext(templateId, organizationId, tx);

      const rowsList = await tx
        .select({ id: templateRows.id, formula: templateRows.formula })
        .from(templateRows)
        .where(eq(templateRows.templateId, templateId));
      for (const r of rowsList) {
        if (r.formula) {
          await tx
            .update(templateRows)
            .set({ formula: context.encode(r.formula) })
            .where(eq(templateRows.id, r.id));
        }
      }

      const secChargesList = await tx
        .select({ id: templateSectionCharges.id, formula: templateSectionCharges.formula })
        .from(templateSectionCharges)
        .innerJoin(templateSections, eq(templateSectionCharges.sectionId, templateSections.id))
        .where(eq(templateSections.templateId, templateId));
      for (const c of secChargesList) {
        if (c.formula) {
          const encoded = context.encode(c.formula) ?? c.formula;
          await tx
            .update(templateSectionCharges)
            .set({ formula: encoded })
            .where(eq(templateSectionCharges.id, c.id));
        }
      }
    }
  });

  return c.json(updated);
}
