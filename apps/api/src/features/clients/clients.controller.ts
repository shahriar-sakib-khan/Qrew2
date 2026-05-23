import { type Context } from 'hono';
import { z } from 'zod';
import { db, clients, customFieldDefinitions, clientStatusEnum } from '@starter/db';
import { eq, and } from 'drizzle-orm';
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

    const result = await db.query.clients.findMany({
      where: eq(clients.organizationId, orgId),
      orderBy: (c, { desc }) => [desc(c.createdAt)],
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

    await db.delete(clients).where(eq(clients.id, id));
    return c.json({ success: true });
  }
}
