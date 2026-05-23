import { Context } from 'hono';
import { auth } from '../../infra/lib/auth';
import { PermissionService } from './permission.service';
import { db, members } from '@starter/db';
import { eq, and } from 'drizzle-orm';

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

      // NEW: Check if the user is the Tenant Owner
      const currentMember = await db.query.members.findFirst({
        where: and(
          eq(members.userId, sessionData.user.id),
          eq(members.organizationId, activeOrgId)
        )
      });

      if (currentMember?.role === 'owner') {
        return c.json({ permissions: ['*'] }, 200); // Owners get the wildcard
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
