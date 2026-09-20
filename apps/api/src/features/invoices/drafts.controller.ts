import { Context } from "hono";
import { db, invoiceDrafts } from "@starter/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const draftSchema = z.object({
  projectId: z.string(),
  sourceTemplateId: z.string().optional(),
  draftHeaderValues: z.record(z.string(), z.string()).optional(),
  draftSections: z.array(z.any()).optional(),
});

export class DraftsController {
  static async getDraft(c: Context) {
    try {
      const organizationId = c.get("organizationId");
      const userId = c.get("userId");
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
      const userId = c.get("userId");
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

      if (existing) {
        const [updated] = await db.update(invoiceDrafts)
          .set({
            sourceTemplateId: payload.sourceTemplateId,
            draftHeaderValues: payload.draftHeaderValues || {},
            draftSections: payload.draftSections || [],
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
            draftHeaderValues: payload.draftHeaderValues || {},
            draftSections: payload.draftSections || [],
            lastAutoSavedAt: new Date()
          })
          .returning();
        return c.json(created);
      }
    } catch (err: any) {
      console.error("[DraftsController.upsertDraft]", err);
      return c.json({ error: "Failed to upsert draft" }, 500);
    }
  }

  static async deleteDraft(c: Context): Promise<Response> {
    try {
      const organizationId = c.get("organizationId");
      const userId = c.get("userId");
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
