import { Context } from "hono";
import { db, invoiceDrafts } from "@starter/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { DraftSeeder } from "./draft-seeder";

const draftSchema = z.object({
  projectId: z.string(),
  sourceTemplateId: z.string().transform((v) => v === "" ? undefined : v).optional(),
  draftHeaderValues: z.record(z.string(), z.string()).optional(),
  draftHeaderFields: z.array(z.any()).optional(),
  draftSections: z.array(z.any()).optional(),
  draftConstants: z.record(z.string(), z.any()).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
});

export class DraftsController {
  static async listDrafts(c: Context) {
    try {
      const organizationId = c.get("organizationId");
      
      const drafts = await db.query.invoiceDrafts.findMany({
        where: eq(invoiceDrafts.organizationId, organizationId),
        with: { project: true },
        orderBy: (d, { desc }) => [desc(d.lastAutoSavedAt)],
      });

      return c.json(drafts);
    } catch (err: any) {
      console.error("[DraftsController.listDrafts]", err);
      return c.json({ error: "Failed to fetch drafts" }, 500);
    }
  }

  static async getDraftById(c: Context) {
    try {
      const organizationId = c.get("organizationId");
      const id = c.req.param("id") as string;

      const draft = await db.query.invoiceDrafts.findFirst({
        where: and(
          eq(invoiceDrafts.organizationId, organizationId),
          eq(invoiceDrafts.id, id)
        ),
        with: {
          project: {
            with: {
              client: true,
              statusRelation: true,  // Resolve status UUID → { name, color, … }
            }
          }
        }
      });

      if (!draft) return c.json({ error: "Draft not found" }, 404);

      return c.json(draft);
    } catch (err: any) {
      console.error("[DraftsController.getDraftById]", err);
      return c.json({ error: "Failed to fetch draft" }, 500);
    }
  }

  static async createDraft(c: Context) {
    try {
      const organizationId = c.get("organizationId");
      const userId = (c.get("user") as any).id;
      const body = await c.req.json();
      const parsed = draftSchema.safeParse(body);

      if (!parsed.success) {
        return c.json({ error: "Invalid payload", details: parsed.error.format() }, 400);
      }

      const payload = parsed.data;

      const [created] = await db.insert(invoiceDrafts)
        .values({
          id: crypto.randomUUID(),
          organizationId,
          projectId: payload.projectId,
          userId,
          sourceTemplateId: payload.sourceTemplateId,
          draftHeaderValues: payload.draftHeaderValues || {},
          draftHeaderFields: payload.draftHeaderFields || [],
          draftSections: payload.draftSections || [],
          name: payload.name || "Draft",
          description: payload.description,
          lastAutoSavedAt: new Date()
        })
        .returning();

      return c.json(created);
    } catch (err: any) {
      console.error("[DraftsController.createDraft]", err);
      return c.json({ error: "Failed to create draft" }, 500);
    }
  }


  static async getDraft(c: Context) {
    try {
      const organizationId = c.get("organizationId");
      const userId = (c.get("user") as any).id;
      const projectId = c.req.query("projectId");

      if (!projectId) {
        return c.json({ error: "projectId is required" }, 400);
      }

      const [draft] = await db.select()
        .from(invoiceDrafts)
        .where(and(
          eq(invoiceDrafts.organizationId, organizationId),
          eq(invoiceDrafts.projectId, projectId),
          eq(invoiceDrafts.userId, userId)
        ))
        .limit(1);

      return c.json(draft || null);
    } catch (err: any) {
      console.error("[DraftsController.getDraft]", err);
      return c.json({ error: "Failed to fetch draft" }, 500);
    }
  }

  static async upsertDraft(c: Context) {
    try {
      const organizationId = c.get("organizationId");
      const userId = (c.get("user") as any).id;
      const body = await c.req.json();
      const parsed = draftSchema.safeParse(body);

      if (!parsed.success) {
        return c.json({ error: "Invalid payload", details: parsed.error.format() }, 400);
      }

      const payload = parsed.data;

      // Try to find existing
      const [existing] = await db.select()
        .from(invoiceDrafts)
        .where(and(
          eq(invoiceDrafts.organizationId, organizationId),
          eq(invoiceDrafts.projectId, payload.projectId),
          eq(invoiceDrafts.userId, userId)
        ))
        .limit(1);

      let { draftSections, draftConstants, draftHeaderValues, draftHeaderFields } = payload;
      
      if (!existing && (!draftSections || draftSections.length === 0)) {
        // Only seed from template if creating a NEW draft
        const templateId = payload.sourceTemplateId;
        if (templateId) {
          const seeded = await DraftSeeder.hydrateFromTemplate(templateId, payload.projectId, organizationId);
          draftSections = seeded.draftSections;
          draftConstants = seeded.draftConstants;
          draftHeaderValues = { ...seeded.draftHeaderValues, ...(payload.draftHeaderValues || {}) };
          draftHeaderFields = seeded.draftHeaderFields;
        }
      }

      if (existing) {
        const [updated] = await db.update(invoiceDrafts)
          .set({
            ...(payload.sourceTemplateId !== undefined ? { sourceTemplateId: payload.sourceTemplateId } : {}),
            ...(payload.draftHeaderValues !== undefined ? { draftHeaderValues: payload.draftHeaderValues } : {}),
            ...(payload.draftHeaderFields !== undefined ? { draftHeaderFields: payload.draftHeaderFields } : {}),
            ...(payload.draftSections !== undefined ? { draftSections: payload.draftSections } : {}),
            ...(payload.draftConstants !== undefined ? { draftConstants: payload.draftConstants } : {}),
            ...(payload.name !== undefined ? { name: payload.name } : {}),
            ...(payload.description !== undefined ? { description: payload.description } : {}),
            lastAutoSavedAt: new Date()
          })
          .where(eq(invoiceDrafts.id, existing.id))
          .returning();
        return c.json(updated);
      } else {
        const [created] = await db.insert(invoiceDrafts)
          .values({
            id: crypto.randomUUID(),
            organizationId,
            projectId: payload.projectId,
            userId,
            sourceTemplateId: payload.sourceTemplateId,
            draftHeaderValues: draftHeaderValues || {},
            draftHeaderFields: draftHeaderFields || [],
            draftSections: draftSections || [],
            draftConstants: draftConstants || {},
            name: payload.name || "Draft",
            description: payload.description,
            lastAutoSavedAt: new Date()
          })
          .returning();
        return c.json(created);
      }
    } catch (err: any) {
      console.error("[DraftsController.upsertDraft]", err);
      return c.json({ error: "Failed to upsert draft", details: err.message, stack: err.stack }, 500);
    }
  }

  static async deleteDraft(c: Context): Promise<Response> {
    try {
      const organizationId = c.get("organizationId");
      const userId = (c.get("user") as any).id;
      const id = c.req.param("id");

      await db.delete(invoiceDrafts)
        .where(and(
          eq(invoiceDrafts.id, id!),
          eq(invoiceDrafts.organizationId, organizationId!),
          eq(invoiceDrafts.userId, userId!)
        ));

      return new Response(null, { status: 204 });
    } catch (err: any) {
      console.error("[DraftsController.deleteDraft]", err);
      return c.json({ error: "Failed to delete draft" }, 500);
    }
  }
}
