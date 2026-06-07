import { type Context } from 'hono';
import { z } from 'zod';
import { db, clients, customFieldDefinitions, clientStatusEnum } from '@starter/db';
import { eq, and, ne } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { createDynamicZodSchema } from '../custom-fields/custom-fields.service';

const baseClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  status: z.enum(clientStatusEnum.enumValues).default('lead'),
  customFields: z.record(z.string(), z.any()).default({}), // We validate this deeper inside the controller
});

export class ClientsController {
  static async listClients(c: Context) {
    const orgId = c.get('organizationId');

    const statusFilter = c.req.query('status'); // 'archived' or 'active'

    let conditions = eq(clients.organizationId, orgId);
    
    if (statusFilter === 'archived') {
      conditions = and(conditions, eq(clients.status, 'archived')) as any;
    } else {
      conditions = and(conditions, ne(clients.status, 'archived')) as any;
    }

    const result = await db.query.clients.findMany({
      where: conditions,
      orderBy: (cl, { desc }) => [desc(cl.createdAt)],
    });

    return c.json(result);
  }

  static async createClient(c: Context) {
    const orgId = c.get('organizationId');
    const body = await c.req.json();
    
    const baseValidation = baseClientSchema.safeParse(body);
    if (!baseValidation.success) {
      return c.json({ error: 'Validation Error', details: baseValidation.error.format() }, 400);
    }

    // 1. Fetch custom field definitions to generate dynamic schema
    const definitions = await db.query.customFieldDefinitions.findMany({
      where: and(
        eq(customFieldDefinitions.organizationId, orgId),
        eq(customFieldDefinitions.entityType, 'client')
      )
    });

    // 2. Dynamically validate the incoming `customFields` payload
    const dynamicSchema = createDynamicZodSchema(definitions);
    const customFieldsValidation = dynamicSchema.safeParse(baseValidation.data.customFields);

    if (!customFieldsValidation.success) {
      return c.json({ 
        error: 'Custom Fields Validation Error', 
        details: customFieldsValidation.error.format() 
      }, 400);
    }

    // 3. Insert
    const [newClient] = await db.insert(clients).values({
      id: uuidv4(),
      organizationId: orgId,
      name: baseValidation.data.name,
      status: baseValidation.data.status,
      customFields: customFieldsValidation.data, // use the perfectly coerced/validated data
    }).returning();

    return c.json(newClient, 201);
  }

  static async updateClient(c: Context) {
    const orgId = c.get('organizationId');
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'Missing ID' }, 400);
    }
    const body = await c.req.json();

    const existing = await db.query.clients.findFirst({
      where: and(eq(clients.id, id), eq(clients.organizationId, orgId))
    });

    if (!existing) return c.json({ error: 'Not Found' }, 404);

    const baseValidation = baseClientSchema.safeParse(body);
    if (!baseValidation.success) {
      return c.json({ error: 'Validation Error', details: baseValidation.error.format() }, 400);
    }

    const definitions = await db.query.customFieldDefinitions.findMany({
      where: and(
        eq(customFieldDefinitions.organizationId, orgId),
        eq(customFieldDefinitions.entityType, 'client')
      )
    });

    const dynamicSchema = createDynamicZodSchema(definitions);
    const customFieldsValidation = dynamicSchema.safeParse(baseValidation.data.customFields);

    if (!customFieldsValidation.success) {
      return c.json({ 
        error: 'Custom Fields Validation Error', 
        details: customFieldsValidation.error.format() 
      }, 400);
    }

    const [updatedClient] = await db.update(clients)
      .set({
        name: baseValidation.data.name,
        status: baseValidation.data.status,
        customFields: customFieldsValidation.data,
      })
      .where(eq(clients.id, id))
      .returning();

    return c.json(updatedClient);
  }

  static async deleteClient(c: Context) {
    const orgId = c.get('organizationId');
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'Missing ID' }, 400);
    }

    const existing = await db.query.clients.findFirst({
      where: and(eq(clients.id, id), eq(clients.organizationId, orgId))
    });

    if (!existing) return c.json({ error: 'Not Found' }, 404);
    if (existing.status !== 'archived') {
      return c.json({ error: 'Must archive client before deleting' }, 400);
    }

    await db.delete(clients).where(eq(clients.id, id));
    return c.json({ success: true });
  }

  static async archiveClient(c: Context) {
    const orgId = c.get('organizationId');
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'Missing ID' }, 400);
    }

    const existing = await db.query.clients.findFirst({
      where: and(eq(clients.id, id), eq(clients.organizationId, orgId))
    });

    if (!existing) return c.json({ error: 'Not Found' }, 404);
    if (existing.status === 'archived') {
      return c.json({ error: 'Already archived' }, 400);
    }

    const [updated] = await db.update(clients)
      .set({
        status: 'archived',
      })
      .where(eq(clients.id, id))
      .returning();

    return c.json(updated);
  }

  static async unarchiveClient(c: Context) {
    const orgId = c.get('organizationId');
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'Missing ID' }, 400);
    }

    const existing = await db.query.clients.findFirst({
      where: and(eq(clients.id, id), eq(clients.organizationId, orgId))
    });

    if (!existing) return c.json({ error: 'Not Found' }, 404);
    if (existing.status !== 'archived') {
      return c.json({ error: 'Not archived' }, 400);
    }

    const [updated] = await db.update(clients)
      .set({
        status: 'lead', // Default to lead or keep it simple.
      })
      .where(eq(clients.id, id))
      .returning();

    return c.json(updated);
  }
}
