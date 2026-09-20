/**
 * Template Sections Controller — V2
 *
 * Manages template sections (the A, B, C… groupings in the template builder).
 *
 * Section token rules:
 * - Auto-named A, B, C, ... AA, AB, ... at creation if name provided without token
 * - sectionToken is FROZEN after creation — never updated
 * - displayName is the user-visible name (mutable)
 * - Returned sections include aggregated row counts and section charges
 */

import { Context } from "hono";
import {
  db,
  templateSections,
  templateRows,
  templateSectionCharges,
  templateRowCharges,
  invoiceTemplates,
} from "@starter/db";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Convert zero-based index to letter sequence: 0→A, 1→B, 25→Z, 26→AA, 27→AB */
function indexToLetter(index: number): string {
  let result = "";
  let n = index;
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
}

/** Derive the next available section token for a template (returns SECTION_A, SECTION_B…). */
async function nextSectionToken(templateId: string): Promise<string> {
  const existing = await db
    .select({ sectionToken: templateSections.sectionToken })
    .from(templateSections)
    .where(eq(templateSections.templateId, templateId))
    .orderBy(asc(templateSections.sortOrder));

  const usedTokens = new Set(existing.map((s) => s.sectionToken));
  let idx = 0;
  while (true) {
    const candidate = `SECTION_${indexToLetter(idx)}`;
    if (!usedTokens.has(candidate)) return candidate;
    idx++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ZOD SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const createSectionSchema = z.object({
  displayName: z.string().min(1).nullish(),
  description: z.string().nullish(),
  sectionToken: z
    .string()
    .min(1)
    .regex(/^[A-Z0-9_]+$/, "sectionToken must be UPPER_SNAKE_CASE")
    .nullish(),
  orderIndex: z.number().int().min(0).default(0),
});

const updateSectionSchema = z.object({
  displayName: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  orderIndex: z.number().int().min(0).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────

export class TemplateSectionsController {
  /** GET /:templateId/sections — list all sections with their rows and charges */
  static async listSections(c: Context) {
    const templateId = c.req.param("templateId") as string;
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    // Verify template belongs to org
    const template = await db.query.invoiceTemplates.findFirst({
      where: and(
        eq(invoiceTemplates.id, templateId),
        eq(invoiceTemplates.organizationId, organizationId)
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

    return c.json(sections);
  }

  /** POST /:templateId/sections — create a section */
  static async createSection(c: Context) {
    const templateId = c.req.param("templateId") as string;
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    const template = await db.query.invoiceTemplates.findFirst({
      where: and(
        eq(invoiceTemplates.id, templateId),
        eq(invoiceTemplates.organizationId, organizationId)
      ),
    });
    if (!template) return c.json({ error: "Template not found" }, 404);

    const body = await c.req.json();
    const parsed = createSectionSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error }, 400);

    // Determine sectionToken
    let sectionToken = parsed.data.sectionToken;
    if (!sectionToken) {
      sectionToken = await nextSectionToken(templateId);
    }

    // Check for token collision
    const collision = await db.query.templateSections.findFirst({
      where: and(
        eq(templateSections.templateId, templateId),
        eq(templateSections.sectionToken, sectionToken)
      ),
    });
    if (collision) {
      return c.json(
        { error: `Section token "${sectionToken}" is already in use in this template.` },
        409
      );
    }

    const [newSection] = await db
      .insert(templateSections)
      .values({
        id: crypto.randomUUID(),
        templateId,
        displayName: parsed.data.displayName ?? null,
        description: parsed.data.description ?? null,
        sectionToken,
        sortOrder: parsed.data.orderIndex,
      })
      .returning();

    return c.json(newSection, 201);
  }

  /** PATCH /:templateId/sections/:sectionId — update displayName or sortOrder only */
  static async updateSection(c: Context) {
    const sectionId = c.req.param("sectionId") as string;
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    // Ownership check
    const sectionRow = await db
      .select({ section: templateSections, org: invoiceTemplates.organizationId })
      .from(templateSections)
      .innerJoin(invoiceTemplates, eq(templateSections.templateId, invoiceTemplates.id))
      .where(
        and(
          eq(templateSections.id, sectionId),
          eq(invoiceTemplates.organizationId, organizationId)
        )
      )
      .limit(1);

    if (sectionRow.length === 0) return c.json({ error: "Section not found" }, 404);

    const body = await c.req.json();
    const parsed = updateSectionSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error }, 400);

    const updateData: Partial<typeof templateSections.$inferInsert> = {};
    if (parsed.data.displayName !== undefined) updateData.displayName = parsed.data.displayName ?? null;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description ?? null;
    if (parsed.data.orderIndex !== undefined) updateData.sortOrder = parsed.data.orderIndex;

    const [updated] = await db
      .update(templateSections)
      .set(updateData)
      .where(eq(templateSections.id, sectionId))
      .returning();

    return c.json(updated);
  }

  /** DELETE /:templateId/sections/:sectionId */
  static async deleteSection(c: Context) {
    const sectionId = c.req.param("sectionId") as string;
    const organizationId = c.get("organizationId");
    if (!organizationId) return c.json({ error: "Unauthorized" }, 401);

    const sectionRow = await db
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

    if (sectionRow.length === 0) return c.json({ error: "Section not found" }, 404);

    // Cascade: rows → components → charges, section charges all delete via FK CASCADE
    await db.delete(templateSections).where(eq(templateSections.id, sectionId));

    return c.json({ success: true });
  }
}
