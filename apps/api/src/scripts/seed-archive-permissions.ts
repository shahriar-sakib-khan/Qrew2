import { db, permissions } from '@starter/db';
import 'dotenv/config';

async function seedArchivePermissions() {
  console.log("Seeding archive permissions...");
  
  try {
    await db.insert(permissions).values([
      { key: 'client:view_archived', description: 'Can view archived clients', category: 'Clients' },
      { key: 'file:view_archived', description: 'Can view archived files (projects)', category: 'Files' },
    ]).onConflictDoNothing();
    
    console.log("Archive permissions seeded successfully!");
  } catch (e) {
    console.error("Failed to seed archive permissions:", e);
  }
  process.exit(0);
}

seedArchivePermissions();
