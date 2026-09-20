import { type Context } from 'hono';
import { z } from 'zod';
import { db, projects, customFieldDefinitions, projectStatusEnum, expenses } from '@starter/db';
import { type SQL, eq, and, ne, sql, sum } from 'drizzle-orm';
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
    const clientId = c.req.query('clientId');
    const statusFilter = c.req.query('status'); // 'archived' or 'active'

    let conditions: SQL | undefined = eq(projects.organizationId, orgId);
    if (clientId) {
      conditions = and(conditions, eq(projects.clientId, clientId));
    }

    // Filter by status
    if (statusFilter === 'archived') {
      conditions = and(conditions, eq(projects.status, 'archived'));
    } else {
      // Default: show all non-archived
      conditions = and(conditions, ne(projects.status, 'archived'));
    }

    const result = await db.query.projects.findMany({
      where: conditions,
      with: { client: true },
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });

    // Compute total expenses per project in a single query
    const projectIds = result.map((p) => p.id);
    let expenseTotals: Record<string, string> = {};

    if (projectIds.length > 0) {
      const totals = await db
        .select({
          projectId: expenses.projectId,
          total: sum(expenses.amount),
        })
        .from(expenses)
        .where(
          and(
            eq(expenses.organizationId, orgId),
            sql`${expenses.projectId} IN (${sql.join(projectIds.map(id => sql`${id}`), sql`, `)})`
          )
        )
        .groupBy(expenses.projectId);

      for (const row of totals) {
        if (row.projectId) {
          expenseTotals[row.projectId] = row.total || '0';
        }
      }
    }

    // Merge totalExpenses into each project
    const enrichedResult = result.map((project) => ({
      ...project,
      totalExpenses: expenseTotals[project.id] || '0',
    }));

    return c.json(enrichedResult);
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

  static async archiveProject(c: Context) {
    const orgId = c.get('organizationId');
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'Missing ID' }, 400);
    }

    const existing = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.organizationId, orgId))
    });

    if (!existing) return c.json({ error: 'Not Found' }, 404);
    if (existing.status === 'archived') {
      return c.json({ error: 'Already archived' }, 400);
    }

    const [updated] = await db.update(projects)
      .set({
        status: 'archived',
        archivedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    return c.json(updated);
  }

  static async unarchiveProject(c: Context) {
    const orgId = c.get('organizationId');
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'Missing ID' }, 400);
    }

    const existing = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.organizationId, orgId))
    });

    if (!existing) return c.json({ error: 'Not Found' }, 404);
    if (existing.status !== 'archived') {
      return c.json({ error: 'Not archived' }, 400);
    }

    const [updated] = await db.update(projects)
      .set({
        status: 'pending',
        archivedAt: null,
      })
      .where(eq(projects.id, id))
      .returning();

    return c.json(updated);
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
    if (existing.status !== 'archived') {
      return c.json({ error: 'Must archive file before deleting' }, 400);
    }

    // Delete attachments from S3
    const { projectAttachments } = await import('@starter/db');
    const attachments = await db.select().from(projectAttachments).where(eq(projectAttachments.projectId, id));
    
    if (attachments.length > 0) {
      const { UploadsService } = await import('../uploads/uploads.service');
      await Promise.all(attachments.map(att => 
        UploadsService.deleteProjectAttachment(orgId, id, att.id)
      ));
    }

    // Then delete project (attachments table should cascade if FK exists, but Drizzle doesn't automatically do it unless configured in the DB. Let's explicitly delete attachments from DB just in case)
    await db.delete(projectAttachments).where(eq(projectAttachments.projectId, id));
    await db.delete(projects).where(eq(projects.id, id));
    
    return c.json({ success: true });
  }

  static async deleteAttachment(c: Context) {
    const orgId = c.get('organizationId');
    const projectId = c.req.param('id');
    const attachmentId = c.req.param('attachmentId');

    if (!projectId || !attachmentId) {
      return c.json({ error: 'Missing projectId or attachmentId' }, 400);
    }

    const { projectAttachments } = await import('@starter/db');

    const existing = await db.query.projectAttachments.findFirst({
      where: and(
        eq(projectAttachments.id, attachmentId),
        eq(projectAttachments.projectId, projectId),
        eq(projectAttachments.organizationId, orgId)
      )
    });

    if (!existing) return c.json({ error: 'Not Found' }, 404);

    // Delete from S3
    const { UploadsService } = await import('../uploads/uploads.service');
    await UploadsService.deleteProjectAttachment(orgId, projectId, attachmentId);

    // Delete from DB
    await db.delete(projectAttachments).where(eq(projectAttachments.id, attachmentId));

    return c.json({ success: true });
  }

  static async getAttachmentUploadUrl(c: Context) {
    const orgId = c.get('organizationId');
    const projectId = c.req.param('id');

    if (!projectId) {
      return c.json({ error: 'Missing projectId' }, 400);
    }

    const body = await c.req.json();
    
    if (!body.contentType || !body.fileName) {
      return c.json({ error: 'contentType and fileName are required' }, 400);
    }

    const fileId = uuidv4();
    const { UploadsService } = await import('../uploads/uploads.service');
    const result = await UploadsService.generateProjectAttachmentPresignedPut(
      orgId,
      projectId,
      fileId,
      body.contentType
    );

    return c.json({ ...result, fileId });
  }

  static async saveAttachment(c: Context) {
    const orgId = c.get('organizationId');
    const projectId = c.req.param('id');

    if (!projectId) {
      return c.json({ error: 'Missing projectId' }, 400);
    }

    const user = c.get('user');
    const body = await c.req.json();

    const { projectAttachments } = await import('@starter/db');

    const [attachment] = await db.insert(projectAttachments).values({
      id: body.fileId || uuidv4(),
      organizationId: orgId,
      projectId,
      uploadedBy: user?.id,
      fileName: body.fileName,
      fileSize: body.fileSize,
      fileType: body.fileType,
      fileUrl: body.fileUrl,
    }).returning();

    return c.json(attachment, 201);
  }

  static async listAttachments(c: Context) {
    const orgId = c.get('organizationId');
    const projectId = c.req.param('id');

    if (!projectId) {
      return c.json({ error: 'Missing projectId' }, 400);
    }

    const { projectAttachments } = await import('@starter/db');

    const result = await db.query.projectAttachments.findMany({
      where: and(
        eq(projectAttachments.organizationId, orgId),
        eq(projectAttachments.projectId, projectId)
      ),
      with: {
        uploader: true
      },
      orderBy: (pa, { desc }) => [desc(pa.createdAt)],
    });

    return c.json(result);
  }
}
