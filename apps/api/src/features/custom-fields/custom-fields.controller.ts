import { type Context } from 'hono';
import { z } from 'zod';
import { db, customFieldDefinitions } from '@starter/db';
import { type SQL, eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { auth } from '../../infra/lib/auth';

const createDefinitionSchema = z.object({
  entityType: z.enum(['client', 'project', 'staff']),
  fieldName: z.string().min(1),
  fieldKey: z.string().min(1).transform(val => val.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")),
  fieldType: z.enum(['text', 'number', 'date', 'boolean', 'single_select', 'multi_select', 'others']),
  isRequired: z.boolean().default(false),
  options: z.array(z.string()).nullable().optional(),
});

export class CustomFieldsController {
  static async listDefinitions(c: Context) {
    const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
    const orgId = sessionData?.session?.activeOrganizationId;

    if (!orgId) {
      return c.json({ error: 'Unauthorized', message: 'No active organization selected.' }, 401);
    }

    const entityType = c.req.query('entityType');

    let conditions: SQL | undefined = eq(customFieldDefinitions.organizationId, orgId);
    if (entityType && (entityType === 'client' || entityType === 'project' || entityType === 'staff')) {
      conditions = and(conditions, eq(customFieldDefinitions.entityType, entityType));
    }

    const definitions = await db.query.customFieldDefinitions.findMany({
      where: conditions,
      orderBy: (defs, { asc }) => [asc(defs.createdAt)],
    });

    return c.json(definitions);
  }

  static async createDefinition(c: Context) {
    const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
    const orgId = sessionData?.session?.activeOrganizationId;

    if (!orgId) {
      return c.json({ error: 'Unauthorized', message: 'No active organization selected.' }, 401);
    }

    const body = await c.req.json();
    const result = createDefinitionSchema.safeParse(body);

    if (!result.success) {
      return c.json({ error: 'Validation Error', details: result.error.format() }, 400);
    }

    const data = result.data;

    // Ensure fieldKey is unique for this org and entity type
    const existing = await db.query.customFieldDefinitions.findFirst({
      where: and(
        eq(customFieldDefinitions.organizationId, orgId),
        eq(customFieldDefinitions.entityType, data.entityType),
        eq(customFieldDefinitions.fieldKey, data.fieldKey)
      )
    });

    if (existing) {
      return c.json({ error: 'Field key already exists for this entity type' }, 409);
    }

    const [newDef] = await db.insert(customFieldDefinitions).values({
      id: uuidv4(),
      organizationId: orgId,
      entityType: data.entityType,
      fieldName: data.fieldName,
      fieldKey: data.fieldKey,
      fieldType: data.fieldType,
      isRequired: data.isRequired,
      options: data.options,
    }).returning();

    return c.json(newDef, 201);
  }

  static async deleteDefinition(c: Context) {
    const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
    const orgId = sessionData?.session?.activeOrganizationId;

    if (!orgId) {
      return c.json({ error: 'Unauthorized', message: 'No active organization selected.' }, 401);
    }

    const id = c.req.param('id');

    if (!id) {
      return c.json({ error: 'Missing ID' }, 400);
    }

    // First check if it exists and isn't seeded/locked (if we choose to enforce that here)
    const existing = await db.query.customFieldDefinitions.findFirst({
      where: and(
        eq(customFieldDefinitions.id, id),
        eq(customFieldDefinitions.organizationId, orgId)
      )
    });

    if (!existing) {
      return c.json({ error: 'Not Found' }, 404);
    }

    await db.delete(customFieldDefinitions).where(eq(customFieldDefinitions.id, id));

    return c.json({ success: true });
  }

  static async updateDefinition(c: Context) {
    const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
    const orgId = sessionData?.session?.activeOrganizationId;

    if (!orgId) {
      return c.json({ error: 'Unauthorized', message: 'No active organization selected.' }, 401);
    }

    const id = c.req.param('id');
    if (!id) return c.json({ error: 'Missing ID' }, 400);

    const body = await c.req.json();

    const existing = await db.query.customFieldDefinitions.findFirst({
      where: and(
        eq(customFieldDefinitions.id, id),
        eq(customFieldDefinitions.organizationId, orgId)
      )
    });

    if (!existing) {
      return c.json({ error: 'Not Found' }, 404);
    }

    // Allow updating name, requirement status, and options.
    const updatedData = {
      fieldName: body.fieldName ?? existing.fieldName,
      isRequired: body.isRequired ?? existing.isRequired,
      options: body.options ?? existing.options,
    };

    const [updatedDef] = await db.update(customFieldDefinitions)
      .set(updatedData)
      .where(eq(customFieldDefinitions.id, id))
      .returning();

    return c.json(updatedDef, 200);
  }
}
