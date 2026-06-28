/**
 * Template Section Charges Controller — V2
 *
 * Manages charges bound to a section (e.g. 10% port levy on SEC_A_BASE).
 *
 * Token: SEC_<SECTION_TOKEN>_<LABEL_SNAKECASE>
 * Formula (reconstructed at eval time): SEC_<SECTION_TOKEN>_<formulaBase> <formulaRest>
 *   e.g. formulaBase=BASE, formulaRest=" * 0.10" → "SEC_A_BASE * 0.10"
 */

import { Context } from "hono";
import {
  db,
  templateSectionCharges,
  templateSections,
  invoiceTemplates,
} from "@starter/db";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";

function toSnakeCase(label: string): string {
  return label
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

const createSectionChargeSchema = z.object({
  label: z.string().min(1),
  subDescription: z.string().optional().nullable(),
  qualifier: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  formulaBase: z.enum(["BASE", "TOTAL", "CHARGES"]),
  formulaRest: z.string().min(1, "formulaRest is required (e.g. \" * 0.10\")"),
  orderIndex: z.number().int().min(0).default(0),
});

const updateSectionChargeSchema = createSectionChargeSchema.partial();

export class TemplateSectionChargesController {
  /** GET /:templateId/sections/:sectionId/section-charges */
  static async listSectionCharges(c: Context) {
    const sectionId = c.req.param("sectionId") as string;
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

    const charges = await db
      .select()
      .from(templateSectionCharges)
      .where(eq(templateSectionCharges.sectionId, sectionId))
      .orderBy(asc(templateSectionCharges.sortOrder));

    return c.json(charges);
  }

  /** POST /:templateId/sections/:sectionId/section-charges */
  static async createSectionCharge(c: Context) {
    const sectionId = c.req.param("sectionId") as string;
    const templateId = c.req.param("templateId") as string;
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    const secResult = await db
      .select({ section: templateSections })
      .from(templateSections)
      .innerJoin(invoiceTemplates, eq(templateSections.templateId, invoiceTemplates.id))
      .where(
        and(
          eq(templateSections.id, sectionId),
          eq(invoiceTemplates.organizationId, organizationId)
        )
      )
      .limit(1);
    if (secResult.length === 0) return c.json({ error: "Section not found" }, 404);

    const sectionToken = secResult[0].section.sectionToken;

    const body = await c.req.json();
    const parsed = createSectionChargeSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error }, 400);

    // Derive chargeToken
    const chargeToken = `SEC_${sectionToken}_${toSnakeCase(parsed.data.label)}`;

    // Check collision
    const dup = await db.query.templateSectionCharges.findFirst({
      where: and(
        eq(templateSectionCharges.sectionId, sectionId),
        eq(templateSectionCharges.chargeToken, chargeToken)
      ),
    });
    if (dup) {
      return c.json({ error: `Section charge token "${chargeToken}" already exists in this section.` }, 409);
    }

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
        formulaBase: parsed.data.formulaBase,
        formulaRest: parsed.data.formulaRest,
        sortOrder: parsed.data.orderIndex,
      })
      .returning();

    return c.json(newCharge, 201);
  }

  /** PATCH /:templateId/sections/:sectionId/section-charges/:chargeId */
  static async updateSectionCharge(c: Context) {
    const chargeId = c.req.param("chargeId") as string;
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    const chargeCheck = await db
      .select({ charge: templateSectionCharges })
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

    const [updated] = await db
      .update(templateSectionCharges)
      .set({
        ...(parsed.data.label !== undefined && { label: parsed.data.label }),
        ...(parsed.data.subDescription !== undefined && { subDescription: parsed.data.subDescription }),
        ...(parsed.data.qualifier !== undefined && { qualifier: parsed.data.qualifier }),
        ...(parsed.data.tags !== undefined && { tags: parsed.data.tags }),
        ...(parsed.data.formulaBase !== undefined && { formulaBase: parsed.data.formulaBase }),
        ...(parsed.data.formulaRest !== undefined && { formulaRest: parsed.data.formulaRest }),
        ...(parsed.data.orderIndex !== undefined && { sortOrder: parsed.data.orderIndex }),
      })
      .where(eq(templateSectionCharges.id, chargeId))
      .returning();

    return c.json(updated);
  }

  /** DELETE /:templateId/sections/:sectionId/section-charges/:chargeId */
  static async deleteSectionCharge(c: Context) {
    const chargeId = c.req.param("chargeId") as string;
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    const chargeCheck = await db
      .select({ id: templateSectionCharges.id })
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

    await db.delete(templateSectionCharges).where(eq(templateSectionCharges.id, chargeId));

    return c.json({ success: true });
  }
}
