/**
 * brands.controller.ts
 * CRUD for the brands master table, scoped by organization.
 * Brands are soft-deactivated (isActive = false) rather than hard-deleted
 * to preserve referential integrity with products.
 */

import { type Context } from 'hono';
import { z } from 'zod';
import { db, brands } from '@starter/db';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const brandSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  isActive: z.boolean().default(true),
});

export class BrandsController {
  // List all brands for the org, ordered by name.
  static async list(c: Context) {
    const orgId = c.get('organizationId');
    const result = await db.query.brands.findMany({
      where: (t, { eq }) => eq(t.organizationId, orgId),
      orderBy: (t, { asc }) => [asc(t.name)],
    });
    return c.json(result);
  }

  static async create(c: Context) {
    const orgId = c.get('organizationId');
    const body = await c.req.json();
    const parsed = brandSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', details: parsed.error.format() }, 400);

    try {
      const [created] = await db.insert(brands).values({
        id: uuidv4(),
        organizationId: orgId,
        name: parsed.data.name,
        isActive: parsed.data.isActive,
      }).returning();
      return c.json(created, 201);
    } catch (err: any) {
      // Unique constraint violation — duplicate name within org.
      if (err?.code === '23505') return c.json({ error: 'A brand with this name already exists.' }, 409);
      throw err;
    }
  }

  static async update(c: Context) {
    const orgId = c.get('organizationId');
    const id = c.req.param('id') as string;
    const body = await c.req.json();
    const parsed = brandSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', details: parsed.error.format() }, 400);

    const existing = await db.query.brands.findFirst({
      where: and(eq(brands.id, id), eq(brands.organizationId, orgId)),
    });
    if (!existing) return c.json({ error: 'Not Found' }, 404);

    try {
      const [updated] = await db.update(brands)
        .set({ name: parsed.data.name, isActive: parsed.data.isActive })
        .where(eq(brands.id, id))
        .returning();
      return c.json(updated);
    } catch (err: any) {
      if (err?.code === '23505') return c.json({ error: 'A brand with this name already exists.' }, 409);
      throw err;
    }
  }

  // Hard delete — blocked by FK if any products still reference the brand.
  // Prefer deactivating (isActive = false) if products exist.
  static async remove(c: Context) {
    const orgId = c.get('organizationId');
    const id = c.req.param('id') as string;

    const existing = await db.query.brands.findFirst({
      where: and(eq(brands.id, id), eq(brands.organizationId, orgId)),
    });
    if (!existing) return c.json({ error: 'Not Found' }, 404);

    await db.delete(brands).where(eq(brands.id, id));
    return c.json({ success: true });
  }
}
