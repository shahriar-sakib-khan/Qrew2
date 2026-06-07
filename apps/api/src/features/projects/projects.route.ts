import { Hono } from 'hono';
import { ProjectsController } from './projects.controller';
import { requireOrgPermission } from '../../infra/middleware/require-permission';

export const projectsRouter = new Hono();

projectsRouter.get('/', requireOrgPermission('file:view'), ProjectsController.listProjects);
projectsRouter.post('/', requireOrgPermission('file:create'), ProjectsController.createProject);
projectsRouter.put('/:id', requireOrgPermission('file:edit'), ProjectsController.updateProject);
projectsRouter.patch('/:id/archive', requireOrgPermission('file:delete'), ProjectsController.archiveProject);
projectsRouter.patch('/:id/unarchive', requireOrgPermission('file:delete'), ProjectsController.unarchiveProject);
projectsRouter.delete('/:id', requireOrgPermission('file:delete'), ProjectsController.deleteProject);

// Attachments
projectsRouter.post('/:id/attachments/presigned', requireOrgPermission('file:edit'), ProjectsController.getAttachmentUploadUrl);
projectsRouter.post('/:id/attachments', requireOrgPermission('file:edit'), ProjectsController.saveAttachment);
projectsRouter.get('/:id/attachments', requireOrgPermission('file:view'), ProjectsController.listAttachments);
projectsRouter.delete('/:id/attachments/:attachmentId', requireOrgPermission('file:edit'), ProjectsController.deleteAttachment);
