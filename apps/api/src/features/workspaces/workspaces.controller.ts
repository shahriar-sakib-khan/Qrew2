import { Context } from 'hono';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { auth } from '../../infra/lib/auth';
import { db } from '@starter/db';
import { users, members, orgRoles, orgMemberRoles } from '@starter/db'; 

export class WorkspacesController {
  static async addStaff(c: Context) {
    try {
      // 1. Authenticate and get active context
      const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!sessionData?.session) return c.json({ error: 'Unauthorized' }, 401);

      const activeOrgId = sessionData.session.activeOrganizationId;
      if (!activeOrgId) return c.json({ error: 'No active workspace selected' }, 400);

      // 2. Parse payload
      const body = await c.req.json();
      const { name, email, roleId } = body; // Notice we now expect a specific custom PBAC roleId

      if (!name || !email || !roleId) {
        return c.json({ error: 'Missing required fields (name, email, roleId)' }, 400);
      }

      // 3. Verify the requested custom role actually exists in this organization
      const targetRole = await db.query.orgRoles.findFirst({
        where: and(eq(orgRoles.id, roleId), eq(orgRoles.organizationId, activeOrgId))
      });
      if (!targetRole) {
        return c.json({ error: 'Invalid role selected.' }, 400);
      }

      const normalizedEmail = email.toLowerCase();
      const existingUser = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) });

      let targetUserId: string;

      if (existingUser) {
        // --- SCENARIO A: User Already Exists ---
        targetUserId = existingUser.id;

        // Security: Prevent hijacking Global Admins
        if (existingUser.role === 'super_admin') {
          return c.json({ error: 'Cannot provision this account.' }, 422); // Silent reject
        }
        
        // Check if already in org
        const alreadyInOrg = await db.query.members.findFirst({
          where: and(eq(members.userId, targetUserId), eq(members.organizationId, activeOrgId))
        });

        if (alreadyInOrg) {
          return c.json({ error: 'User is already a member of this workspace.' }, 409);
        }

        // [TODO]: Send an email notification: "You have been added to Workspace X"

      } else {
        // --- SCENARIO B: Brand New User (Pattern 3) ---
        // Generate an impossible-to-guess, throwaway 64-character password
        const throwawayPassword = crypto.randomBytes(32).toString('base64url');

        const newUserResponse = await auth.api.signUpEmail({
          body: { email: normalizedEmail, name, password: throwawayPassword },
          headers: new Headers(), // Empty headers so it doesn't modify the Admin's session
        });

        if (!newUserResponse?.user) throw new Error('Failed to create user');
        targetUserId = newUserResponse.user.id;

        // Trigger Better Auth's Forget Password flow. 
        // This securely emails the new user a link to set their real password.
        await auth.api.requestPasswordReset({
          body: { email: normalizedEmail, redirectTo: '/dashboard' },
          headers: new Headers(),
        });
      }

      // 4. Bind to the Organization (Better Auth Layer)
      const newMemberId = uuidv4();
      await db.insert(members).values({
        id: newMemberId,
        organizationId: activeOrgId,
        userId: targetUserId,
        role: 'member', // Better Auth base role is ALWAYS 'member' for staff
      });

      // 5. Bind to the Custom Role (Our PBAC Layer)
      await db.insert(orgMemberRoles).values({
        id: uuidv4(),
        organizationId: activeOrgId,
        memberId: newMemberId,
        roleId: targetRole.id,
        assignedBy: sessionData.user.id,
      });

      return c.json({
        success: true,
        message: existingUser ? 'Existing user added to workspace.' : 'Staff provisioned and activation email sent.',
      }, 200);

    } catch (error) {
      console.error('[WorkspacesController.addStaff] Failed:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }
}
