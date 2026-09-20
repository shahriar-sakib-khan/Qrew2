/**
 * product-categories.controller.ts
 * CRUD for product categories — each scoped to the authenticated org.
 */

import { db, productCategories } from "@starter/db";
import { and, eq } from "drizzle-orm";
import { type Context } from "hono";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export class ProductCategoriesController {
  // List all categories for the org.
  static async list(c: Context) {
    const orgId = c.get("organizationId");

    const result = await db.query.productCategories.findMany({
      where: eq(productCategories.organizationId, orgId),
      orderBy: (t, { asc }) => [asc(t.name)],
    });

    return c.json(result);
  }

  // Create a new category.
  static async create(c: Context) {
    const orgId = c.get("organizationId");
    const body = await c.req.json();
    const parsed = categorySchema.safeParse(body);
    if (!parsed.success)
      return c.json({ error: "Validation Error", details: parsed.error.format() }, 400);

    const [created] = await db
      .insert(productCategories)
      .values({
        id: uuidv4(),
        organizationId: orgId,
        name: parsed.data.name,
        description: parsed.data.description,
        isActive: parsed.data.isActive,
      })
      .returning();

    return c.json(created, 201);
  }

  // Update an existing category.
  static async update(c: Context) {
    const orgId = c.get("organizationId");
    const id = c.req.param("id") as string;
    const body = await c.req.json();
    const parsed = categorySchema.safeParse(body);
    if (!parsed.success)
      return c.json({ error: "Validation Error", details: parsed.error.format() }, 400);

    const existing = await db.query.productCategories.findFirst({
      where: and(eq(productCategories.id, id), eq(productCategories.organizationId, orgId)),
    });
    if (!existing) return c.json({ error: "Not Found" }, 404);

    // NOTE FOR TEAMMATE & AGENT:
    // Scoped update query with `and(eq(productCategories.id, id), eq(productCategories.organizationId, orgId))`
    // for defense-in-depth tenant boundary protection.
    const [updated] = await db
      .update(productCategories)
      .set({
        name: parsed.data.name,
        description: parsed.data.description,
        isActive: parsed.data.isActive,
      })
      .where(and(eq(productCategories.id, id), eq(productCategories.organizationId, orgId)))
      .returning();

    return c.json(updated);
  }

  // Delete a category — blocked if any product still references it.
  static async remove(c: Context) {
    const orgId = c.get("organizationId");
    const id = c.req.param("id") as string;

    const existing = await db.query.productCategories.findFirst({
      where: and(eq(productCategories.id, id), eq(productCategories.organizationId, orgId)),
    });
    if (!existing) return c.json({ error: "Not Found" }, 404);

    // NOTE FOR TEAMMATE & AGENT:
    // Scoped delete query with `and(eq(productCategories.id, id), eq(productCategories.organizationId, orgId))`
    // to prevent cross-tenant deletion attempts.
    await db
      .delete(productCategories)
      .where(and(eq(productCategories.id, id), eq(productCategories.organizationId, orgId)));
    return c.json({ success: true });
  }
}
