import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, projectStatuses } from "@starter/db";
import { eq, and, asc } from "drizzle-orm";
import { requireOrgPermission } from "../../infra/middleware/require-permission";

const projectStatusesRoute = new Hono<{ Variables: { organizationId: string } }>();

export const projectStatusesSchema = z.object({
  name: z.string().min(1, "Name is required"),
  order: z.number().int().min(0).optional(),
});

projectStatusesRoute.get("/", requireOrgPermission("file:view"), async (c) => {
  const orgId = c.get("organizationId") as string;
  const statuses = await db.query.projectStatuses.findMany({
    where: eq(projectStatuses.organizationId, orgId),
    orderBy: [asc(projectStatuses.order), asc(projectStatuses.createdAt)],
  });
  return c.json(statuses);
});

projectStatusesRoute.post("/", requireOrgPermission("org:manage"), zValidator("json", projectStatusesSchema), async (c) => {
  const orgId = c.get("organizationId") as string;
  const data = c.req.valid("json");
  
  const newId = crypto.randomUUID();
  const [newStatus] = await db.insert(projectStatuses).values({
    id: newId,
    organizationId: orgId,
    name: data.name,
    order: data.order ?? 0,
    isDefault: false,
    isSystem: false,
  }).returning();

  return c.json(newStatus, 201);
});

projectStatusesRoute.patch("/:id", requireOrgPermission("org:manage"), zValidator("json", projectStatusesSchema), async (c) => {
  const orgId = c.get("organizationId") as string;
  const id = c.req.param("id") as string;
  const data = c.req.valid("json");

  const [existing] = await db.select().from(projectStatuses).where(and(
    eq(projectStatuses.id, id),
    eq(projectStatuses.organizationId, orgId)
  ));

  if (!existing) {
    return c.json({ error: "Status not found" }, 404);
  }
  
  if (existing.isSystem) {
    // Only allow order updates for system statuses, not renaming
    if (data.name !== existing.name) {
      return c.json({ error: "System statuses cannot be renamed" }, 403);
    }
  }

  const [updated] = await db.update(projectStatuses)
    .set({
      name: data.name,
      order: data.order,
      updatedAt: new Date()
    })
    .where(and(
      eq(projectStatuses.id, id),
      eq(projectStatuses.organizationId, orgId)
    ))
    .returning();

  return c.json(updated);
});

projectStatusesRoute.delete("/:id", requireOrgPermission("org:manage"), async (c) => {
  const orgId = c.get("organizationId") as string;
  const id = c.req.param("id") as string;

  const [existing] = await db.select().from(projectStatuses).where(and(
    eq(projectStatuses.id, id),
    eq(projectStatuses.organizationId, orgId)
  ));

  if (!existing) {
    return c.json({ error: "Status not found" }, 404);
  }

  if (existing.isSystem) {
    return c.json({ error: "System statuses cannot be deleted" }, 403);
  }
  
  if (existing.isDefault) {
    return c.json({ error: "Default statuses cannot be deleted" }, 403);
  }

  await db.delete(projectStatuses)
    .where(and(
      eq(projectStatuses.id, id),
      eq(projectStatuses.organizationId, orgId)
    ));

  return c.json({ success: true });
});

export { projectStatusesRoute };
