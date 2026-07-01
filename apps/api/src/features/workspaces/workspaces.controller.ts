import { Context } from 'hono';
import { eq, and, sql, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { auth } from '../../infra/lib/auth';
import { db } from '@starter/db';
import * as schema from '@starter/db';
import { users, members, orgRoles, orgMemberRoles } from '@starter/db'; 

export class WorkspacesController {
  static async createWorkspace(c: Context) {
    try {
      const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!sessionData?.session) return c.json({ error: 'Unauthorized' }, 401);
      
      const body = await c.req.json();
      const { name } = body;
      if (!name) return c.json({ error: 'Organization name is required' }, 400);

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const orgId = uuidv4();
      const memberId = uuidv4();
      const userId = sessionData.user.id;

      await db.transaction(async (tx) => {
        // 1. Create Organization
        await tx.insert(schema.organizations).values({
          id: orgId,
          name,
          slug,
          createdAt: new Date(),
        });

        // 2. Create Member (Owner)
        await tx.insert(schema.members).values({
          id: memberId,
          organizationId: orgId,
          userId: userId,
          role: 'owner',
          createdAt: new Date(),
        });

        // 3. Seed Defaults
        await schema.seedOrganizationDefaults(tx, orgId, userId);
      });

      return c.json({ success: true, organizationId: orgId }, 201);
    } catch (error) {
      console.error('[WorkspacesController.createWorkspace] Failed:', error);
      return c.json({ error: 'Failed to create workspace' }, 500);
    }
  }

  static async inviteStaff(c: Context) {
    try {
      // 1. Authenticate and get active context
      const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!sessionData?.session) return c.json({ error: 'Unauthorized' }, 401);

      const activeOrgId = sessionData.session.activeOrganizationId;
      if (!activeOrgId) return c.json({ error: 'No active workspace selected' }, 400);

      // 2. Parse payload
      const body = await c.req.json();
      const { email, roleId } = body; 

      if (!email || !roleId) {
        return c.json({ error: 'Missing required fields (email, roleId)' }, 400);
      }

      // 3. Verify the requested custom role actually exists in this organization
      const targetRole = await db.query.orgRoles.findFirst({
        where: and(eq(orgRoles.id, roleId), eq(orgRoles.organizationId, activeOrgId))
      });
      if (!targetRole) {
        return c.json({ error: 'Invalid role selected.' }, 400);
      }

      const normalizedEmail = email.toLowerCase();
      
      // Get org details for the email
      const org = await db.query.organizations.findFirst({
        where: eq(schema.organizations.id, activeOrgId)
      });

      // 4. Create the invitation in the DB
      const inviteId = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      await db.insert(schema.invitations).values({
        id: inviteId,
        organizationId: activeOrgId,
        email: normalizedEmail,
        role: roleId, // Store custom PBAC roleId here
        status: 'pending',
        expiresAt,
        inviterId: sessionData.user.id,
      });

      // 5. Send the email
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, normalizedEmail)
      });

      const { sendSmartEmail } = await import('../../infra/lib/auth');
      const frontendUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite?id=${inviteId}`;
      const orgName = org?.name || 'a workspace';
      
      const emailContent = existingUser 
        ? `<div style="font-family: sans-serif; padding: 20px;">
             <h2>Workspace Invitation</h2>
             <p><strong>${sessionData.user.name}</strong> has invited you to join the office <strong>${orgName}</strong>.</p>
             <a href="${frontendUrl}" style="display: inline-block; padding: 10px 20px; background: #000; color: #fff; text-decoration: none; border-radius: 5px;">Accept Invitation</a>
           </div>`
        : `<div style="font-family: sans-serif; padding: 20px;">
             <h2>Workspace Invitation</h2>
             <p><strong>${sessionData.user.name}</strong> has invited you to join the office <strong>${orgName}</strong>.</p>
             <p>Create an account to accept the invitation and join the team.</p>
             <a href="${frontendUrl}" style="display: inline-block; padding: 10px 20px; background: #000; color: #fff; text-decoration: none; border-radius: 5px;">Create an account and accept invitation</a>
           </div>`;

      await sendSmartEmail(
        normalizedEmail,
        `You have been invited to join ${orgName}`,
        emailContent
      );

      return c.json({
        success: true,
        message: 'Invitation Sent Successfully',
      }, 200);

    } catch (error) {
      console.error('[WorkspacesController.inviteStaff] Failed:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  static async listInvitations(c: Context) {
    try {
      const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!sessionData?.session) return c.json({ error: 'Unauthorized' }, 401);

      const activeOrgId = sessionData.session.activeOrganizationId;
      if (!activeOrgId) return c.json({ error: 'No active workspace selected' }, 400);

      const pendingInvites = await db.select({
        id: schema.invitations.id,
        email: schema.invitations.email,
        status: schema.invitations.status,
        expiresAt: schema.invitations.expiresAt,
        roleName: orgRoles.name,
      })
      .from(schema.invitations)
      .where(and(
        eq(schema.invitations.organizationId, activeOrgId),
        eq(schema.invitations.status, 'pending')
      ))
      .leftJoin(orgRoles, eq(orgRoles.id, schema.invitations.role));

      return c.json({ invitations: pendingInvites }, 200);
    } catch (error) {
      console.error('[WorkspacesController.listInvitations] Failed:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  static async getInvitation(c: Context) {
    try {
      const inviteId = c.req.param('id');
      if (!inviteId) return c.json({ error: 'Missing invite id' }, 400);

      const invite = await db.query.invitations.findFirst({
        where: and(eq(schema.invitations.id, inviteId), eq(schema.invitations.status, 'pending'))
      });

      if (!invite || invite.expiresAt < new Date()) {
        return c.json({ error: 'Invalid or expired invitation' }, 404);
      }

      const org = await db.query.organizations.findFirst({
        where: eq(schema.organizations.id, invite.organizationId)
      });

      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, invite.email)
      });

      return c.json({
        email: invite.email,
        orgName: org?.name || 'a workspace',
        userExists: !!existingUser
      }, 200);
    } catch (error) {
      console.error('[WorkspacesController.getInvitation] Failed:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  static async cancelInvitation(c: Context) {
    try {
      const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!sessionData?.session) return c.json({ error: 'Unauthorized' }, 401);

      const activeOrgId = sessionData.session.activeOrganizationId;
      if (!activeOrgId) return c.json({ error: 'No active workspace selected' }, 400);

      const inviteId = c.req.param('id');
      if (!inviteId) return c.json({ error: 'Missing invite id' }, 400);

      await db.delete(schema.invitations).where(
        and(eq(schema.invitations.id, inviteId), eq(schema.invitations.organizationId, activeOrgId))
      );

      return c.json({ success: true }, 200);
    } catch (error) {
      console.error('[WorkspacesController.cancelInvitation] Failed:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  static async acceptInvitation(c: Context) {
    try {
      const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!sessionData?.session) return c.json({ error: 'Unauthorized' }, 401);

      const { id: inviteId } = await c.req.json();
      if (!inviteId) return c.json({ error: 'Missing invitation id' }, 400);

      const invite = await db.query.invitations.findFirst({
        where: and(eq(schema.invitations.id, inviteId), eq(schema.invitations.status, 'pending'))
      });

      if (!invite) return c.json({ error: 'Invalid or expired invitation' }, 404);

      if (invite.expiresAt < new Date()) {
        return c.json({ error: 'Invitation has expired' }, 400);
      }

      if (invite.email !== sessionData.user.email) {
        return c.json({ error: 'This invitation is for a different email address' }, 403);
      }

      // Check if user is already a member
      const alreadyMember = await db.query.members.findFirst({
        where: and(eq(members.userId, sessionData.user.id), eq(members.organizationId, invite.organizationId))
      });

      if (alreadyMember) {
        // Just delete the invite
        await db.delete(schema.invitations).where(eq(schema.invitations.id, inviteId));
        return c.json({ success: true, message: 'Already a member' }, 200);
      }

      // Bind to organization (Better Auth base role)
      const newMemberId = uuidv4();
      await db.insert(members).values({
        id: newMemberId,
        organizationId: invite.organizationId,
        userId: sessionData.user.id,
        role: 'member',
      });

      // Bind to Custom PBAC role if provided
      if (invite.role) {
        await db.insert(orgMemberRoles).values({
          id: uuidv4(),
          organizationId: invite.organizationId,
          memberId: newMemberId,
          roleId: invite.role, // role column holds our PBAC roleId
          assignedBy: invite.inviterId,
        });
      }

      // Update invitation status to accepted or just delete it
      await db.delete(schema.invitations).where(eq(schema.invitations.id, inviteId));

      return c.json({ success: true, organizationId: invite.organizationId }, 200);
    } catch (error) {
      console.error('[WorkspacesController.acceptInvitation] Failed:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  static async listStaff(c: Context) {
    try {
      const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!sessionData?.session) return c.json({ error: 'Unauthorized' }, 401);

      const activeOrgId = sessionData.session.activeOrganizationId;
      if (!activeOrgId) return c.json({ error: 'No active workspace selected' }, 400);

      const staffList = await db.select({
        memberId: members.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        createdAt: members.createdAt,
        memberBaseRole: members.role, // Fetch Better Auth base role to detect 'owner'
        roleName: orgRoles.name,
        roleId: orgRoles.id,
        isSystem: orgRoles.isSystem,
      })
      .from(members)
      .where(eq(members.organizationId, activeOrgId))
      .innerJoin(users, eq(users.id, members.userId))
      .leftJoin(orgMemberRoles, eq(orgMemberRoles.memberId, members.id))
      .leftJoin(orgRoles, eq(orgRoles.id, orgMemberRoles.roleId));

      const balances = await db
        .select({
          userId: schema.walletTransactions.memberId,
          balance: sql<number>`SUM(CASE WHEN ${schema.walletTransactions.type} = 'credit' THEN ${schema.walletTransactions.amount} ELSE -${schema.walletTransactions.amount} END)`
        })
        .from(schema.walletTransactions)
        .where(eq(schema.walletTransactions.organizationId, activeOrgId))
        .groupBy(schema.walletTransactions.memberId);

      const balanceMap = new Map(balances.map(b => [b.userId, Number(b.balance) || 0]));

      const staffMap = new Map();
      for (const s of staffList) {
        if (!staffMap.has(s.memberId)) {
          staffMap.set(s.memberId, s);
        } else {
          const existing = staffMap.get(s.memberId);
          // Prefer specific roles over empty or generic ones
          if (!existing.roleName && s.roleName) {
            staffMap.set(s.memberId, s);
          }
        }
      }

      const uniqueStaffList = Array.from(staffMap.values());

      const staff = uniqueStaffList.map(s => {
        if (s.memberBaseRole === 'owner') {
          return { ...s, roleName: 'Owner', isSystem: true, walletBalance: balanceMap.get(s.userId) || 0 };
        }
        return {
          ...s,
          roleName: s.roleName || 'Member',
          walletBalance: balanceMap.get(s.userId) || 0
        };
      });

      return c.json({ staff }, 200);
    } catch (error) {
      console.error('[WorkspacesController.listStaff] Failed:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  static async updateStaffRole(c: Context) {
    try {
      const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!sessionData?.session) return c.json({ error: 'Unauthorized' }, 401);

      const activeOrgId = sessionData.session.activeOrganizationId;
      if (!activeOrgId) return c.json({ error: 'No active workspace selected' }, 400);

      const memberId = c.req.param('memberId');
      const { roleId } = await c.req.json();

      if (!memberId || !roleId) {
        return c.json({ error: 'Missing memberId or roleId' }, 400);
      }

      const targetRole = await db.query.orgRoles.findFirst({
        where: and(eq(orgRoles.id, roleId), eq(orgRoles.organizationId, activeOrgId))
      });

      if (!targetRole) {
        return c.json({ error: 'Invalid role selected.' }, 400);
      }

      const targetMember = await db.query.members.findFirst({
        where: and(eq(members.id, memberId), eq(members.organizationId, activeOrgId))
      });

      if (!targetMember) {
        return c.json({ error: 'Member not found.' }, 404);
      }

      await db.delete(orgMemberRoles).where(
        eq(orgMemberRoles.memberId, memberId)
      );

      await db.insert(orgMemberRoles).values({
        id: uuidv4(),
        organizationId: activeOrgId,
        memberId: memberId,
        roleId: roleId,
        assignedBy: sessionData.user.id,
      });

      return c.json({ success: true }, 200);
    } catch (error) {
      console.error('[WorkspacesController.updateStaffRole] Failed:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  static async revokeStaff(c: Context) {
    const orgId = c.get('organizationId');
    const memberId = c.req.param('memberId');

    if (!orgId || !memberId) {
      return c.json({ error: 'Missing organizationId or memberId' }, 400);
    }

    const { members } = await import('@starter/db');

    const [deleted] = await db.delete(members)
      .where(and(eq(members.id, memberId), eq(members.organizationId, orgId)))
      .returning();

    if (!deleted) return c.json({ error: 'Member not found' }, 404);

    return c.json({ success: true });
  }

  // --- Organization Settings ---
  static async getSettings(c: Context) {
    try {
      const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!sessionData?.session) return c.json({ error: 'Unauthorized' }, 401);
      
      const orgId = sessionData.session.activeOrganizationId;
      if (!orgId) return c.json({ error: 'No active workspace selected' }, 400);

      const { organizations } = await import('@starter/db');

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId)
      });

      if (!org) return c.json({ error: 'Organization not found' }, 404);

      let metadata = {};
      try {
        if (org.metadata) {
          metadata = JSON.parse(org.metadata);
        }
      } catch (e) {
        // Ignore parse errors
      }

      return c.json({ metadata });
    } catch (error) {
      console.error('[WorkspacesController.getSettings] Failed:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  static async updateSettings(c: Context) {
    try {
      const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!sessionData?.session) return c.json({ error: 'Unauthorized' }, 401);
      
      const orgId = sessionData.session.activeOrganizationId;
      if (!orgId) return c.json({ error: 'No active workspace selected' }, 400);

      const body = await c.req.json();
      const metadata = body.metadata;

      const { organizations } = await import('@starter/db');

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId)
      });

      if (!org) return c.json({ error: 'Organization not found' }, 404);

      let currentMetadata = {};
      try {
        if (org.metadata) {
          currentMetadata = JSON.parse(org.metadata);
        }
      } catch (e) {
        // Ignore parse errors
      }

      const newMetadata = { ...currentMetadata, ...metadata };

      await db.update(organizations)
        .set({ metadata: JSON.stringify(newMetadata) })
        .where(eq(organizations.id, orgId));

      return c.json({ success: true, metadata: newMetadata });
    } catch (error) {
      console.error('[WorkspacesController.updateSettings] Failed:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  static async getDashboardStats(c: Context) {
    try {
      const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!sessionData?.session) return c.json({ error: 'Unauthorized' }, 401);

      const activeOrgId = sessionData.session.activeOrganizationId;
      if (!activeOrgId) return c.json({ error: 'No active workspace selected' }, 400);

      const [totalClientsRes] = await db.select({ count: sql<number>`count(*)` })
        .from(schema.clients)
        .where(eq(schema.clients.organizationId, activeOrgId));

      const [totalProjectsRes] = await db.select({ count: sql<number>`count(*)` })
        .from(schema.projects)
        .where(and(eq(schema.projects.organizationId, activeOrgId), eq(schema.projects.status, 'active')));

      const [totalExpensesRes] = await db.select({ sum: sql<number>`sum(${schema.expenses.amount})` })
        .from(schema.expenses)
        .where(eq(schema.expenses.organizationId, activeOrgId));

      const [pendingInvoicesRes] = await db.select({ count: sql<number>`count(*)` })
        .from(schema.invoices)
        .where(and(eq(schema.invoices.organizationId, activeOrgId), eq(schema.invoices.status, 'draft')));

      const recentFiles = await db.select()
        .from(schema.projects)
        .where(eq(schema.projects.organizationId, activeOrgId))
        .orderBy(desc(schema.projects.createdAt))
        .limit(5);

      const recentInvoices = await db.select()
        .from(schema.invoices)
        .where(eq(schema.invoices.organizationId, activeOrgId))
        .orderBy(desc(schema.invoices.createdAt))
        .limit(5);

      return c.json({
        totalClients: Number(totalClientsRes?.count) || 0,
        activeFiles: Number(totalProjectsRes?.count) || 0,
        totalExpenses: Number(totalExpensesRes?.sum) || 0,
        pendingInvoices: Number(pendingInvoicesRes?.count) || 0,
        recentFiles,
        recentInvoices
      }, 200);

    } catch (error) {
      console.error('[WorkspacesController.getDashboardStats] Failed:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }
}
