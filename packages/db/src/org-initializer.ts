import { v4 as uuidv4 } from 'uuid';
import { expenseCategories, projectStatuses, orgRoles, orgRolePermissions } from './schema';
import { eq, and } from 'drizzle-orm';

export async function seedOrganizationDefaults(db: any, orgId: string, userId: string) {
  // 1. Seed Expense Categories
  const existingCategories = await db.select().from(expenseCategories).where(
    eq(expenseCategories.organizationId, orgId)
  );

  if (existingCategories.length === 0) {
    await db.insert(expenseCategories).values([
      { id: uuidv4(), organizationId: orgId, name: 'Transportation', tokenKey: 'TRANSPORTATION' },
      { id: uuidv4(), organizationId: orgId, name: 'Office', tokenKey: 'OFFICE' },
      { id: uuidv4(), organizationId: orgId, name: 'Others', tokenKey: 'OTHERS' },
    ]);
  }

  // 2. Seed Project Statuses
  const existingStatuses = await db.select().from(projectStatuses).where(
    eq(projectStatuses.organizationId, orgId)
  );

  if (existingStatuses.length === 0) {
    await db.insert(projectStatuses).values([
      { id: uuidv4(), organizationId: orgId, name: 'Created', order: 1, isDefault: true, isSystem: true },
      { id: uuidv4(), organizationId: orgId, name: 'Completed', order: 2, isDefault: false, isSystem: false },
    ]);
  }

  // 3. Seed Roles
  const existingRoles = await db.select().from(orgRoles).where(
    eq(orgRoles.organizationId, orgId)
  );

  if (existingRoles.length === 0) {
    const ownerRoleId = uuidv4();
    const managerRoleId = uuidv4();
    const staffRoleId = uuidv4();

    await db.insert(orgRoles).values([
      {
        id: ownerRoleId,
        organizationId: orgId,
        name: 'Owner',
        description: 'Full administrative access',
        isSystem: true,
        createdBy: userId,
      },
      {
        id: managerRoleId,
        organizationId: orgId,
        name: 'Manager',
        description: 'Can manage files, clients, and financials',
        isSystem: false,
        createdBy: userId,
      },
      {
        id: staffRoleId,
        organizationId: orgId,
        name: 'Staff',
        description: 'Standard access for operational staff',
        isSystem: false,
        createdBy: userId,
      }
    ]);
  }

  // Fetch roles again to get their IDs (in case they already existed)
  const roles = await db.select().from(orgRoles).where(
    eq(orgRoles.organizationId, orgId)
  );

  const ownerRole = roles.find((r: any) => r.name === 'Owner');
  const managerRole = roles.find((r: any) => r.name === 'Manager');
  const staffRole = roles.find((r: any) => r.name === 'Staff');

  if (ownerRole || managerRole || staffRole) {
    // Role Permissions Mapping
    const permissionsToInsert: { roleId: string; permissionKey: string }[] = [];

    const ownerPerms = [
      'staff:view', 'staff:view_details', 'staff:view_sensitive', 'staff:invite', 'staff:create', 'staff:edit_role', 'staff:revoke',
      'role:view', 'role:create', 'role:edit', 'role:delete',
      'client:view', 'client:view_details', 'client:view_sensitive', 'client:create', 'client:edit', 'client:archive', 'client:restore', 'client:delete', 'client:view_archived',
      'file:view', 'file:view_details', 'file:view_sensitive', 'file:create', 'file:edit', 'file:archive', 'file:restore', 'file:delete', 'file:view_archived',
      'finance:view_expenses', 'finance:request_funds', 'finance:approve_funds', 'finance:record_expense',
      'finance:view_wallets', 'finance:view_wallet_details', 'finance:manage_wallets', 'finance:manage_categories',
      'invoice:view', 'invoice:create', 'invoice:edit', 'invoice:delete',
      'template:view', 'template:create', 'template:edit', 'template:delete',
      'workspace:manage_fields', 'workspace:manage_billing', 'workspace:manage_settings',
      'audit:view'
    ];

    const managerPerms = [
      'staff:view', 'staff:view_details', 'staff:invite',
      'client:view', 'client:view_details', 'client:create', 'client:edit', 'client:archive',
      'file:view', 'file:view_details', 'file:create', 'file:edit', 'file:archive',
      'finance:view_expenses', 'finance:request_funds', 'finance:approve_funds', 'finance:record_expense',
      'finance:view_wallets',
      'invoice:view', 'invoice:create', 'invoice:edit',
      'template:view'
    ];

    const staffPerms = [
      'staff:view',
      'client:view', 'client:create', 'client:edit',
      'file:view', 'file:view_details', 'file:create', 'file:edit',
      'finance:view_expenses', 'finance:request_funds'
    ];

    // Clear existing permissions for these roles so we can safely re-insert
    const roleIdsToClear = [ownerRole?.id, managerRole?.id, staffRole?.id].filter(Boolean) as string[];

    // We can't delete with an array in a simple way without 'inArray', so we loop (safe for 3 items)
    for (const roleId of roleIdsToClear) {
      await db.delete(orgRolePermissions).where(eq(orgRolePermissions.roleId, roleId));
    }

    if (ownerRole) ownerPerms.forEach(key => permissionsToInsert.push({ roleId: ownerRole.id, permissionKey: key }));
    if (managerRole) managerPerms.forEach(key => permissionsToInsert.push({ roleId: managerRole.id, permissionKey: key }));
    if (staffRole) staffPerms.forEach(key => permissionsToInsert.push({ roleId: staffRole.id, permissionKey: key }));

    if (permissionsToInsert.length > 0) {
      await db.insert(orgRolePermissions).values(permissionsToInsert);
    }

    // Update Manager and Staff to be isSystem: false if they were previously created as true
    for (const role of [managerRole, staffRole].filter(Boolean)) {
      if (role && role.isSystem) {
         await db.update(orgRoles).set({ isSystem: false }).where(eq(orgRoles.id, role.id));
      }
    }
  }
}
