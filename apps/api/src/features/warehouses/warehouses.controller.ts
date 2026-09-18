/**
 * warehouses.controller.ts
 * Manages physical storage locations. warehouseId is optional on documents in v1
 * to support single-branch organizations that don't need per-document warehouse selection.
 */

import { type Context } from 'hono';
import { z } from 'zod';
import { db, warehouses } from '@starter/db';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const warehouseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export class WarehousesController {
  static async list(c: Context) {
    const orgId = c.get('organizationId');

    const result = await db.query.warehouses.findMany({
      where: eq(warehouses.organizationId, orgId),
      orderBy: (t, { asc }) => [asc(t.name)],
    });

    const enriched = result.map((w) => ({
      ...w,
      location: w.address,
    }));

    return c.json(enriched);
  }

  static async create(c: Context) {
    const orgId = c.get('organizationId');
    const body = await c.req.json();
    const parsed = warehouseSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', details: parsed.error.format() }, 400);

    const addressValue = parsed.data.address ?? parsed.data.location ?? null;

    const [created] = await db.insert(warehouses).values({
      id: uuidv4(),
      organizationId: orgId,
      name: parsed.data.name,
      code: parsed.data.code,
      address: addressValue,
      isActive: parsed.data.isActive,
    }).returning();

    return c.json({ ...created, location: created.address }, 201);
  }

  static async update(c: Context) {
    const orgId = c.get('organizationId');
    const id = c.req.param('id') as string;
    const body = await c.req.json();
    const parsed = warehouseSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'Validation Error', details: parsed.error.format() }, 400);

    const existing = await db.query.warehouses.findFirst({
      where: and(eq(warehouses.id, id), eq(warehouses.organizationId, orgId)),
    });
    if (!existing) return c.json({ error: 'Not Found' }, 404);

    const addressValue = parsed.data.address ?? parsed.data.location ?? null;

    const [updated] = await db.update(warehouses)
      .set({ name: parsed.data.name, code: parsed.data.code, address: addressValue, isActive: parsed.data.isActive })
      .where(eq(warehouses.id, id))
      .returning();

    return c.json({ ...updated, location: updated.address });
  }

  static async remove(c: Context) {
    const orgId = c.get('organizationId');
    const id = c.req.param('id') as string;

    const existing = await db.query.warehouses.findFirst({
      where: and(eq(warehouses.id, id), eq(warehouses.organizationId, orgId)),
    });
    if (!existing) return c.json({ error: 'Not Found' }, 404);

    try {
      await db.delete(warehouses).where(eq(warehouses.id, id));
      return c.json({ success: true });
    } catch (err: any) {
      if (err?.code === '23503') {
        return c.json({ error: 'Cannot delete a warehouse that has transaction history.' }, 409);
      }
      throw err;
    }
  }
}

