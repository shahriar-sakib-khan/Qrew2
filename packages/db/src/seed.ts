import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { permissions } from './schema/pbac';
import { organizations, users, accounts } from './schema/auth';
import { customFieldDefinitions } from './schema/custom_fields';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import 'dotenv/config';

function generateKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password.normalize("NFKC"),
      salt,
      64,
      { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      }
    );
  });
}

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await generateKey(password, salt);
  return `${salt}:${key.toString("hex")}`;
}

const DEFAULT_USERS = [
  { email: 'user@qrew.com', name: 'Regular User', role: 'user' as const },
  { email: 'admin@qrew.com', name: 'Admin User', role: 'admin' as const },
  { email: 'super@qrew.com', name: 'Super Admin', role: 'super_admin' as const }
];

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is missing in environment variables.");
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

const INITIAL_PERMISSIONS = [
  // Staff
  { key: 'staff:view', category: 'Staff', description: 'View the staff directory' },
  { key: 'staff:provision', category: 'Staff', description: 'Directly create new staff accounts' },
  { key: 'staff:revoke', category: 'Staff', description: 'Remove staff from the workspace' },
  
  // Roles
  { key: 'role:view', category: 'Roles', description: 'View custom roles' },
  { key: 'role:manage', category: 'Roles', description: 'Create and edit custom roles and permissions' },
  
  // Clients
  { key: 'client:view', category: 'Clients', description: 'View client profiles' },
  { key: 'client:create', category: 'Clients', description: 'Add new clients' },
  { key: 'client:edit', category: 'Clients', description: 'Edit existing clients' },
  { key: 'client:delete', category: 'Clients', description: 'Delete clients' },
  { key: 'client:view_archived', category: 'Clients', description: 'View archived clients' },
  
  // Files / Projects
  { key: 'file:view', category: 'Files', description: 'View operational files/projects list' },
  { key: 'file:view_details', category: 'Files', description: 'View granular details of a specific file' },
  { key: 'file:create', category: 'Files', description: 'Create new files' },
  { key: 'file:edit', category: 'Files', description: 'Edit existing files' },
  { key: 'file:delete', category: 'Files', description: 'Delete operational files' },
  { key: 'file:view_archived', category: 'Files', description: 'View archived files' },
  
  // Financials
  { key: 'finance:view_expenses', category: 'Financials', description: 'View expense and requisition histories' },
  { key: 'finance:request_funds', category: 'Financials', description: 'Submit requests for money (Maker)' },
  { key: 'finance:approve_funds', category: 'Financials', description: 'Approve or deny money requests (Checker)' },
  { key: 'finance:record_expense', category: 'Financials', description: 'Record finalized expenses against files' },
  { key: 'finance:view_wallets', category: 'Financials', description: 'View organization wallets and staff balances' },
  { key: 'finance:manage_wallets', category: 'Financials', description: 'Manually adjust wallet balances' },
  { key: 'finance:view_invoices', category: 'Financials', description: 'View generated invoices' },
  { key: 'finance:manage_invoices', category: 'Financials', description: 'Create, edit, and send invoices' },
  { key: 'finance:manage_categories', category: 'Financials', description: 'Manage expense categories' },
  
  // Workspace / Schema
  { key: 'schema:manage_fields', category: 'Workspace', description: 'Edit custom fields for clients, files, and staff' },
  { key: 'workspace:manage_billing', category: 'Workspace', description: 'Manage subscription and billing' },
  { key: 'org:manage', category: 'Workspace', description: 'Manage organization settings and defaults' }
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

    console.log("3. Seeding Default Users...");
    const defaultHash = await hashPassword('12345678');
    for (const u of DEFAULT_USERS) {
      // Check if user already exists
      const existingUser = await db.select()
        .from(users)
        .where(eq(users.email, u.email))
        .limit(1);

      let userId = existingUser[0]?.id;

      if (!userId) {
        userId = uuidv4();
        await db.insert(users).values({
          id: userId,
          email: u.email,
          name: u.name,
          role: u.role,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`Created user: ${u.email}`);
      } else {
        // Update role if user already exists
        await db.update(users)
          .set({ role: u.role, updatedAt: new Date() })
          .where(eq(users.id, userId));
        console.log(`Updated user role: ${u.email} to ${u.role}`);
      }

      // Check if credential account already exists
      const existingAccount = await db.select()
        .from(accounts)
        .where(eq(accounts.userId, userId))
        .limit(1);

      if (!existingAccount[0]) {
        await db.insert(accounts).values({
          id: uuidv4(),
          userId: userId,
          accountId: userId,
          providerId: 'credential',
          password: defaultHash,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } else {
        await db.update(accounts)
          .set({ password: defaultHash, updatedAt: new Date() })
          .where(eq(accounts.userId, userId));
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
