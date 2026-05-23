import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { permissions } from './schema/pbac';
import { organizations } from './schema/auth';
import { customFieldDefinitions } from './schema/custom_fields';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is missing in environment variables.");
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

const INITIAL_PERMISSIONS = [
  { key: 'staff:view', category: 'Staff', description: 'View the staff directory' },
  { key: 'staff:provision', category: 'Staff', description: 'Directly create new staff accounts' },
  { key: 'staff:revoke', category: 'Staff', description: 'Remove staff from the workspace' },
  { key: 'role:view', category: 'Roles', description: 'View custom roles' },
  { key: 'role:manage', category: 'Roles', description: 'Create and edit custom roles and permissions' },
  { key: 'client:view', category: 'Clients', description: 'View client profiles' },
  { key: 'client:create', category: 'Clients', description: 'Add new clients' },
  { key: 'client:edit', category: 'Clients', description: 'Edit existing clients' },
  { key: 'client:delete', category: 'Clients', description: 'Delete clients' },
  { key: 'file:view', category: 'Files', description: 'View operational files' },
  { key: 'file:create', category: 'Files', description: 'Create new files' },
  { key: 'file:edit', category: 'Files', description: 'Edit existing files' },
  { key: 'file:delete', category: 'Files', description: 'Delete operational files' },
  { key: 'finance:view_expenses', category: 'Financials', description: 'View ledgers and expenses' },
  { key: 'finance:request_funds', category: 'Financials', description: 'Submit requests for money (Maker)' },
  { key: 'finance:approve_funds', category: 'Financials', description: 'Approve or deny money requests (Checker)' },
  { key: 'finance:record_expense', category: 'Financials', description: 'Record finalized expenses against files' },
  { key: 'finance:manage_categories', category: 'Financials', description: 'Manage expense categories and taxonomy' },
  { key: 'schema:manage_fields', category: 'Workspace', description: 'Modify custom JSONB fields for entities' },
  { key: 'workspace:manage_billing', category: 'Workspace', description: 'Manage subscription and billing' }
];

const SEED_CUSTOM_FIELDS = [
  { entityType: 'client' as const, fieldName: 'Email', fieldKey: 'email', fieldType: 'text' as const, isRequired: false },
  { entityType: 'client' as const, fieldName: 'Phone', fieldKey: 'phone', fieldType: 'text' as const, isRequired: false },
  { entityType: 'client' as const, fieldName: 'Address', fieldKey: 'address', fieldType: 'text' as const, isRequired: false },
  { entityType: 'project' as const, fieldName: 'Start Date', fieldKey: 'start_date', fieldType: 'date' as const, isRequired: false },
  { entityType: 'project' as const, fieldName: 'Deadline', fieldKey: 'deadline', fieldType: 'date' as const, isRequired: false },
  { entityType: 'project' as const, fieldName: 'Total Expense', fieldKey: 'total_expense', fieldType: 'number' as const, isRequired: false }
];

async function main() {
  console.log("🌱 Starting Database Seed...");

  try {
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
    
    console.log("2. Seeding Custom Fields for all Organizations...");
    const orgs = await db.select().from(organizations);
    
    for (const org of orgs) {
      for (const field of SEED_CUSTOM_FIELDS) {
        await db.insert(customFieldDefinitions)
          .values({
            id: uuidv4(),
            organizationId: org.id,
            entityType: field.entityType,
            fieldName: field.fieldName,
            fieldKey: field.fieldKey,
            fieldType: field.fieldType,
            isRequired: field.isRequired,
            isSeeded: true, // Marked as seeded so users can delete/modify them if they want
          })
          .onConflictDoNothing(); // Prevent duplicate seeded fields if re-run
      }
    }

    console.log("✅ Seed completed successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:");
    console.error(error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
