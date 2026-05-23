import { type Context } from 'hono';
import { z } from 'zod';
import { db, projects, customFieldDefinitions, projectStatusEnum } from '@starter/db';
import { type SQL, eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { createDynamicZodSchema } from '../custom-fields/custom-fields.service';

const baseProjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  clientId: z.string().min(1, 'Client ID is required'),
  status: z.enum(projectStatusEnum.enumValues).default('pending'),
  customFields: z.record(z.string(), z.any()).default({}), // We validate this deeper inside the controller
});

export class ProjectsController {
  static async listProjects(c: Context) {
    const orgId = c.get('organizationId');
    const clientId = c.req.query('clientId'); // Optional filter

    let conditions: SQL | undefined = eq(projects.organizationId, orgId);
    if (clientId) {
      conditions = and(conditions, eq(projects.clientId, clientId));
    }

    const result = await db.query.projects.findMany({
      where: conditions,
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });

    return c.json(result);
  }

  static async createProject(c: Context) {
    const orgId = c.get('organizationId');
    const body = await c.req.json();
    
    const baseValidation = baseProjectSchema.safeParse(body);
    if (!baseValidation.success) {
      return c.json({ error: 'Validation Error', details: baseValidation.error.format() }, 400);
    }

    const definitions = await db.query.customFieldDefinitions.findMany({
      where: and(
        eq(customFieldDefinitions.organizationId, orgId),
        eq(customFieldDefinitions.entityType, 'project')
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

    const [newProject] = await db.insert(projects).values({
      id: uuidv4(),
      organizationId: orgId,
      clientId: baseValidation.data.clientId,
      name: baseValidation.data.name,
      status: baseValidation.data.status,
      customFields: customFieldsValidation.data,
    }).returning();

    return c.json(newProject, 201);
  }

  static async updateProject(c: Context) {
    const orgId = c.get('organizationId');
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'Missing ID' }, 400);
    }
    const body = await c.req.json();

    const existing = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.organizationId, orgId))
    });

    if (!existing) return c.json({ error: 'Not Found' }, 404);

    const baseValidation = baseProjectSchema.safeParse(body);
    if (!baseValidation.success) {
      return c.json({ error: 'Validation Error', details: baseValidation.error.format() }, 400);
    }

    const definitions = await db.query.customFieldDefinitions.findMany({
      where: and(
        eq(customFieldDefinitions.organizationId, orgId),
        eq(customFieldDefinitions.entityType, 'project')
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

    const [updatedProject] = await db.update(projects)
      .set({
        clientId: baseValidation.data.clientId,
        name: baseValidation.data.name,
        status: baseValidation.data.status,
        customFields: customFieldsValidation.data,
      })
      .where(eq(projects.id, id))
      .returning();

    return c.json(updatedProject);
  }

  static async deleteProject(c: Context) {
    const orgId = c.get('organizationId');
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'Missing ID' }, 400);
    }

    const existing = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.organizationId, orgId))
    });

    if (!existing) return c.json({ error: 'Not Found' }, 404);

    await db.delete(projects).where(eq(projects.id, id));
    return c.json({ success: true });
  }
}
