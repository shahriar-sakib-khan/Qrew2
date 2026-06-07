import { Context, Next } from 'hono';
import { auth } from '../lib/auth';
import { PermissionService } from '../../features/permissions/permission.service';
import { db, members } from '@starter/db';
import { eq, and } from 'drizzle-orm';

export const requireOrgPermission = (requiredPermission: string) => {
  return async (c: Context, next: Next) => {
    // 1. Validate Session
    const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!sessionData?.session || !sessionData?.user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // 2. Global Admin Bypass (Super Admins ignore tenant boundaries)
    if (sessionData.user.role === 'super_admin') {
      return await next();
    }

    // 3. Validate Tenant Context
    const orgId = sessionData.session.activeOrganizationId;
    if (!orgId) {
      return c.json({ error: 'No active workspace context selected.' }, 400);
    }
    
    // Set the organizationId in the context so downstream controllers can use it
    c.set('organizationId', orgId);

    // NEW: Tenant Owner Bypass
    const currentMember = await db.query.members.findFirst({
      where: and(
        eq(members.userId, sessionData.user.id),
        eq(members.organizationId, orgId)
      )
    });

    if (currentMember?.role === 'owner') {
      return await next(); // Owners bypass all PBAC checks
    }

    // 4. Resolve & Verify Permissions
    const userPermissions = await PermissionService.resolvePermissions(sessionData.user.id, orgId);

    if (!userPermissions.has(requiredPermission)) {
      console.warn(`[PBAC] Blocked: User ${sessionData.user.id} attempted to access ${requiredPermission}`);
      return c.json({ 
        error: 'Forbidden', 
        message: `You do not have the required permission: ${requiredPermission}` 
      }, 403);
    }

    // Passed all checks
    await next();
  };
};
