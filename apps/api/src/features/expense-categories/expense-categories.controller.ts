import { type Context } from "hono";
import { z } from "zod";
import { db, expenseCategories } from "@starter/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { auth } from "../../infra/lib/auth";

const createCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  tokenKey: z.string().regex(/^[A-Z0-9_]+$/, "Must be UPPER_SNAKE_CASE").optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

function generateTokenKey(name: string) {
  return name.toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

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

  let tokenKey = parsed.data.tokenKey;
  if (!tokenKey) {
    tokenKey = generateTokenKey(parsed.data.name);
  }

  try {
    const [newCategory] = await db
      .insert(expenseCategories)
      .values({
        id: uuidv4(),
        organizationId,
        name: parsed.data.name,
        description: parsed.data.description,
        tokenKey,
      })
      .returning();

    return c.json(newCategory, 201);
  } catch (error: any) {
    if (error.code === "23505") {
      return c.json({ error: "Category with this token already exists" }, 409);
    }
    throw error;
  }
}

export async function updateCategory(c: Context) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const organizationId = session?.session?.activeOrganizationId;

  if (!organizationId) {
    return c.json({ error: "Missing organization ID" }, 401);
  }

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "Missing ID" }, 400);
  }

  const body = await c.req.json();
  const parsed = updateCategorySchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid data", details: parsed.error.format() }, 400);
  }

  try {
    const [updatedCategory] = await db
      .update(expenseCategories)
      .set(parsed.data)
      .where(
        and(
          eq(expenseCategories.id, id),
          eq(expenseCategories.organizationId, organizationId)
        )
      )
      .returning();

    if (!updatedCategory) {
      return c.json({ error: "Category not found" }, 404);
    }

    return c.json(updatedCategory);
  } catch (error: any) {
    if (error.code === "23505") {
      return c.json({ error: "Category with this token already exists" }, 409);
    }
    throw error;
  }
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

  try {
    await db
      .delete(expenseCategories)
      .where(
        and(
          eq(expenseCategories.id, id),
          eq(expenseCategories.organizationId, organizationId)
        )
      );

    return c.json({ success: true });
  } catch (error: any) {
    if (error.code === "23503") {
      return c.json({ error: "Cannot delete this category because it is already used in expenses." }, 409);
    }
    throw error;
  }
}
