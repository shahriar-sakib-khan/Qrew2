import { permissions } from './schema';

const INITIAL_PERMISSIONS = [
  // Clients
  { key: 'client:view', category: 'Clients', description: 'View client list and basic profiles' },
  { key: 'client:view_details', category: 'Clients', description: 'View detailed client fields' },
  { key: 'client:view_sensitive', category: 'Clients', description: 'View sensitive client fields' },
  { key: 'client:create', category: 'Clients', description: 'Add new clients' },
  { key: 'client:edit', category: 'Clients', description: 'Update client details' },
  { key: 'client:archive', category: 'Clients', description: 'Soft-delete clients' },
  { key: 'client:restore', category: 'Clients', description: 'Restore archived clients' },
  { key: 'client:delete', category: 'Clients', description: 'Permanently delete clients' },
  { key: 'client:view_archived', category: 'Clients', description: 'View archived clients' },
  
  // Projects / Files
  { key: 'file:view', category: 'Files', description: 'View operational files/projects list' },
  { key: 'file:view_details', category: 'Files', description: 'View detailed project fields' },
  { key: 'file:view_sensitive', category: 'Files', description: 'View sensitive project fields' },
  { key: 'file:create', category: 'Files', description: 'Create new files' },
  { key: 'file:edit', category: 'Files', description: 'Edit existing files' },
  { key: 'file:archive', category: 'Files', description: 'Soft-delete operational files' },
  { key: 'file:restore', category: 'Files', description: 'Restore archived files' },
  { key: 'file:delete', category: 'Files', description: 'Permanently delete operational files' },
  { key: 'file:view_archived', category: 'Files', description: 'View archived operational files' },
  
  // Financials
  { key: 'finance:view_expenses', category: 'Financials', description: 'View expense and requisition histories' },
  { key: 'finance:request_funds', category: 'Financials', description: 'Submit requests for money (Maker)' },
  { key: 'finance:approve_funds', category: 'Financials', description: 'Approve or deny money requests (Checker)' },
  { key: 'finance:record_expense', category: 'Financials', description: 'Record finalized expenses against files' },
  { key: 'finance:view_wallets', category: 'Financials', description: 'View organization wallets and basic balances' },
  { key: 'finance:view_wallet_details', category: 'Financials', description: 'View granular wallet transaction history and details' },
  { key: 'finance:manage_wallets', category: 'Financials', description: 'Manually adjust wallet balances' },
  { key: 'finance:manage_categories', category: 'Financials', description: 'Manage expense categories' },
  
  // Invoicing
  { key: 'invoice:view', category: 'Invoicing', description: 'See generated invoices' },
  { key: 'invoice:create', category: 'Invoicing', description: 'Generate new invoices' },
  { key: 'invoice:edit', category: 'Invoicing', description: 'Edit draft invoices' },
  { key: 'invoice:delete', category: 'Invoicing', description: 'Void or Delete invoices' },
  
  // Invoice Templates
  { key: 'template:view', category: 'Invoice Templates', description: 'View available invoice templates' },
  { key: 'template:create', category: 'Invoice Templates', description: 'Create new invoice templates' },
  { key: 'template:edit', category: 'Invoice Templates', description: 'Update existing invoice templates' },
  { key: 'template:delete', category: 'Invoice Templates', description: 'Remove invoice templates' },
  
  // Staff
  { key: 'staff:view', category: 'Staff', description: 'View the staff directory' },
  { key: 'staff:view_details', category: 'Staff', description: 'View detailed staff fields' },
  { key: 'staff:view_sensitive', category: 'Staff', description: 'View sensitive staff fields' },
  { key: 'staff:invite', category: 'Staff', description: 'Send an email invitation to new staff' },
  { key: 'staff:create', category: 'Staff', description: 'Directly create new staff accounts' },
  { key: 'staff:edit_role', category: 'Staff', description: 'Change another staff members role' },
  { key: 'staff:revoke', category: 'Staff', description: 'Remove staff from the workspace' },
  
  // Roles
  { key: 'role:view', category: 'Roles', description: 'View custom roles' },
  { key: 'role:create', category: 'Roles', description: 'Create new custom roles' },
  { key: 'role:edit', category: 'Roles', description: 'Modify role permissions and names' },
  { key: 'role:delete', category: 'Roles', description: 'Delete custom roles' },
  
  // Workspace / Schema
  { key: 'workspace:manage_fields', category: 'Workspace', description: 'Create and edit custom fields for clients, files, and staff' },
  { key: 'workspace:manage_billing', category: 'Workspace', description: 'Manage subscription and billing' },
  { key: 'workspace:manage_settings', category: 'Workspace', description: 'Manage organization settings and defaults' },
  
  // Audit
  { key: 'audit:view', category: 'Audit', description: 'View the activity logs / audit trails for accountability' }
];

export async function seedPermissionsDefaults(db: any) {
  console.log("1. Seeding PBAC Permissions...");
  for (const perm of INITIAL_PERMISSIONS) {
    await db.insert(permissions)
      .values(perm)
      .onConflictDoUpdate({
        target: permissions.key,
        set: {
          description: perm.description,
          category: perm.category,
        },
      });
  }
}
