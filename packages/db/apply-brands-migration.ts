/**
 * apply-brands-migration.ts
 * Applies the 0002_brands.sql migration directly without drizzle-kit,
 * using the same approach as fix-migrations.ts.
 *
 * Run: npx tsx apply-brands-migration.ts
 */

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from './src/index';
import fs from 'fs';
import path from 'path';

async function applyBrandsMigration() {
  const migrationPath = path.join(__dirname, 'drizzle', '0002_brands.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

  console.log('[1/2] Applying 0002_brands.sql ...');

  // Strip SQL comments (lines starting with --) and split on semicolons.
  // Execute each statement individually to get granular error reporting.
  const statements = migrationSQL
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    console.log(`  Executing: ${statement.slice(0, 80)}...`);
    await db.execute(sql.raw(statement));
  }

  console.log('[2/2] Migration applied successfully.');
  process.exit(0);
}

applyBrandsMigration().catch((err) => {
  console.error('Migration failed:', err.message ?? err);
  process.exit(1);
});
