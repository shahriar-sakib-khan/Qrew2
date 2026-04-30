import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { permissions } from './schema/pbac';
import 'dotenv/config'; // Ensure environment variables are loaded

// 1. Connection setup (using standard postgres-js driver)
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is missing in environment variables.");
}

// Disable prefetch as it is not supported for "Transaction" pool mode (standard for seeding)
const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

// 2. The Master Registry Array
const INITIAL_PERMISSIONS = [
  // Staff & Roles
  { key: 'staff:view', category: 'Staff', description: 'View the staff directory' },
  { key: 'staff:provision', category: 'Staff', description: 'Directly create new staff accounts' },
  { key: 'staff:revoke', category: 'Staff', description: 'Remove staff from the workspace' },
  { key: 'role:view', category: 'Roles', description: 'View custom roles' },
  { key: 'role:manage', category: 'Roles', description: 'Create and edit custom roles and permissions' },

  // Core Entities (Clients & Files)
  { key: 'client:view', category: 'Clients', description: 'View client profiles' },
  { key: 'client:create', category: 'Clients', description: 'Add new clients' },
  { key: 'client:edit', category: 'Clients', description: 'Edit existing clients' },
  { key: 'client:delete', category: 'Clients', description: 'Delete clients' },
  
  { key: 'file:view', category: 'Files', description: 'View operational files' },
  { key: 'file:create', category: 'Files', description: 'Create new files' },
  { key: 'file:edit', category: 'Files', description: 'Edit existing files' },
  { key: 'file:delete', category: 'Files', description: 'Delete operational files' },

  // Financials (Maker / Checker)
  { key: 'finance:view_expenses', category: 'Financials', description: 'View ledgers and expenses' },
  { key: 'finance:request_funds', category: 'Financials', description: 'Submit requests for money (Maker)' },
  { key: 'finance:approve_funds', category: 'Financials', description: 'Approve or deny money requests (Checker)' },
  { key: 'finance:record_expense', category: 'Financials', description: 'Record finalized expenses against files' },
  { key: 'finance:manage_categories', category: 'Financials', description: 'Manage expense categories and taxonomy' },

  // Workspace Settings
  { key: 'schema:manage_fields', category: 'Workspace', description: 'Modify custom JSONB fields for entities' },
  { key: 'workspace:manage_billing', category: 'Workspace', description: 'Manage subscription and billing' }
];

// 3. The Execution Logic
async function main() {
  console.log("🌱 Starting PBAC permission seed...");

  try {
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
    
    console.log("✅ Seed completed successfully! PBAC registry is up to date.");
  } catch (error) {
    console.error("❌ Seeding failed:");
    console.error(error);
    process.exit(1);
  } finally {
    // Close the database connection to exit the script cleanly
    await sql.end();
  }
}

main();
