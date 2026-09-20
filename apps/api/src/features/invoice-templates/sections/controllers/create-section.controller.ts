import { Context } from "hono";
import { db, templateSections, invoiceTemplates } from "@starter/db";
import { nextSectionToken } from "../services/section-index.service";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const createSectionSchema = z.object({
  label: z.string().min(1).nullish(),
  description: z.string().nullish(),
  sectionToken: z
    .string()
    .min(1)
    .regex(/^[A-Z0-9_]+$/, "sectionToken must be UPPER_SNAKE_CASE")
    .nullish(),
  orderIndex: z.number().int().min(0).default(0),
});

export async function createSection(c: Context) {
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

  let sectionToken = parsed.data.sectionToken;
  if (!sectionToken) {
    sectionToken = await nextSectionToken(templateId);
  }

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
      label: parsed.data.label ?? null,
      description: parsed.data.description ?? null,
      sectionToken,
      sortOrder: parsed.data.orderIndex,
    })
    .returning();

  return c.json(newSection, 201);
}
