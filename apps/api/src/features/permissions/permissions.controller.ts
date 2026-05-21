import { Context } from 'hono';
import { auth } from '../../infra/lib/auth';
import { PermissionService } from './permission.service';

export class PermissionsController {
  static async getMyPermissions(c: Context) {
    try {
      const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
      const activeOrgId = sessionData?.session?.activeOrganizationId;

      if (!sessionData || !activeOrgId) {
        return c.json({ permissions: [] }, 200); // Fail gracefully for the UI
      }

      // Global Admins get a special wildcard or bypass flag on the frontend
      if (sessionData.user.role === 'super_admin') {
        return c.json({ permissions: ['*'] }, 200);
      }

      const permissionSet = await PermissionService.resolvePermissions(sessionData.user.id, activeOrgId);
      
      // Convert Set to Array for JSON serialization
      return c.json({ permissions: Array.from(permissionSet) }, 200);
    } catch (error) {
      console.error('[PermissionsController.getMyPermissions] Failed:', error);
      return c.json({ permissions: [] }, 500);
    }
  }
}
