import { type Context } from "hono";
import { z } from "zod";
import { db, expenseCategories } from "@starter/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { auth } from "../../infra/lib/auth";

const createCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export async function createCategory(c: Context) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const organizationId = session?.session?.activeOrganizationId;
  
  if (!organizationId) {
    return c.json({ error: "Missing organization ID" }, 401);
  }

  const body = await c.req.json();
  const parsed = createCategorySchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid data", details: parsed.error.format() }, 400);
  }

  const [newCategory] = await db
    .insert(expenseCategories)
    .values({
      id: uuidv4(),
      organizationId,
      name: parsed.data.name,
      description: parsed.data.description,
    })
    .returning();

  return c.json(newCategory, 201);
}

export async function listCategories(c: Context) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const organizationId = session?.session?.activeOrganizationId;

  if (!organizationId) {
    return c.json({ error: "Missing organization ID" }, 401);
  }

  const categories = await db
    .select()
    .from(expenseCategories)
    .where(eq(expenseCategories.organizationId, organizationId));

  return c.json(categories);
}

export async function deleteCategory(c: Context) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const organizationId = session?.session?.activeOrganizationId;

  if (!organizationId) {
    return c.json({ error: "Missing organization ID" }, 401);
  }

  const id = c.req.param("id");

  if (!id) {
    return c.json({ error: "Missing ID" }, 400);
  }

  await db
    .delete(expenseCategories)
    .where(
      and(
        eq(expenseCategories.id, id),
        eq(expenseCategories.organizationId, organizationId)
      )
    );

  return c.json({ success: true });
}
