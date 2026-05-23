import { Hono } from 'hono';
import { ProjectsController } from './projects.controller';
import { requireOrgPermission } from '../../infra/middleware/require-permission';

export const projectsRouter = new Hono();

projectsRouter.get('/', requireOrgPermission('file:view'), ProjectsController.listProjects);
projectsRouter.post('/', requireOrgPermission('file:create'), ProjectsController.createProject);
projectsRouter.put('/:id', requireOrgPermission('file:edit'), ProjectsController.updateProject);
projectsRouter.delete('/:id', requireOrgPermission('file:delete'), ProjectsController.deleteProject);
