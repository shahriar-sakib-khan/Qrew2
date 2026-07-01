import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { seedPermissionsDefaults } from './seed-permissions';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is missing in environment variables.");
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function main() {
  console.log("🌱 Starting Database Seed...");

  try {
    // Seed global system permissions
    await seedPermissionsDefaults(db);
    
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
