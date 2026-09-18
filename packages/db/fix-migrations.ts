/**
 * fix-migrations.ts
 * One-time fix script: marks the 0000 migration as already applied in the
 * __drizzle_migrations tracking table, then runs only the 0001 inventory migration.
 *
 * WHY this is needed:
 * The database was set up (via drizzle push or direct SQL) before the migrations
 * tracking table existed. So `drizzle-kit migrate` tries to re-run 0000 and fails
 * with "type already exists". This script inserts the 0000 hash into the tracking
 * table so drizzle knows to skip it, then applies 0001 normally.
 */

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from './src/index';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Hash the migration file content — drizzle uses this to identify applied migrations.
function hashMigration(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function fixMigrations() {
  const migration0000Path = path.join(__dirname, 'drizzle', '0000_rainy_ghost_rider.sql');
  const migration0001Path = path.join(__dirname, 'drizzle', '0001_inventory_module.sql');

  // Step 1: Ensure the drizzle migrations tracking table exists.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  console.log('[1/4] Migrations table ensured.');

  // Step 2: Check if 0000 is already recorded.
  const existing = await db.execute(sql`
    SELECT hash FROM "__drizzle_migrations" LIMIT 10
  `);

  // The postgres driver returns the result array directly (not .rows).
  const appliedCount = Array.isArray(existing) ? existing.length : (existing as any).rows?.length ?? 0;
  console.log(`[2/4] Currently applied migrations: ${appliedCount}`);

  if (appliedCount === 0) {
    // 0000 is not recorded — insert it so drizzle skips it.
    const hash0000 = hashMigration(migration0000Path);
    await db.execute(sql`
      INSERT INTO "__drizzle_migrations" (hash, created_at)
      VALUES (${hash0000}, ${Date.now()})
    `);
    console.log('[3/4] Marked 0000_rainy_ghost_rider as already applied.');
  } else {
    console.log('[3/4] 0000 already in migrations table — skipping insert.');
  }


  // Step 3: Apply 0001 inventory module migration directly.
  const sql0001 = fs.readFileSync(migration0001Path, 'utf-8');

  // Split on drizzle's statement breakpoint marker and run each statement.
  const statements = sql0001
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`[4/4] Applying 0001_inventory_module.sql (${statements.length} statements)...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await db.execute(sql.raw(stmt));
      process.stdout.write('.');
    } catch (err: any) {
      // Skip errors for objects that already exist or don't exist (idempotent safety).
      // 42P07 = table already exists, 42710 = type already exists,
      // 42701 = column already exists, 42P01 = table/relation not found (already dropped),
      // 42703 = column not found (already dropped), 42704 = type not found (already dropped).
      const skipCodes = ['42P07', '42710', '42701', '42P01', '42703', '42704'];
      if (skipCodes.includes(err?.code)) {
        process.stdout.write('s'); // s = skipped (already exists or already gone)
      } else {
        console.error(`\n\nFailed on statement ${i + 1}:\n${stmt}\n`);
        throw err;
      }
    }
  }

  // Step 4: Record 0001 in migrations table so drizzle knows it was applied.
  const hash0001 = hashMigration(migration0001Path);
  await db.execute(sql`
    INSERT INTO "__drizzle_migrations" (hash, created_at)
    VALUES (${hash0001}, ${Date.now()})
    ON CONFLICT DO NOTHING
  `);

  console.log('\n\n✅ Done! All inventory tables created successfully.');
  process.exit(0);
}

fixMigrations().catch((err) => {
  console.error('\n❌ Fix failed:', err);
  process.exit(1);
});
