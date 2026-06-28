// One-time migration script: add new columns to template_rows
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL not set');

const sql = postgres(DATABASE_URL);

async function run() {
  console.log('Applying migration: add value columns to template_rows...');
  try {
    await sql`ALTER TABLE "template_rows" ADD COLUMN IF NOT EXISTS "description" text`;
    console.log('✓ description');
    await sql`ALTER TABLE "template_rows" ADD COLUMN IF NOT EXISTS "value_type" "component_value_type_enum" NOT NULL DEFAULT 'normal'`;
    console.log('✓ value_type');
    await sql`ALTER TABLE "template_rows" ADD COLUMN IF NOT EXISTS "formula" text`;
    console.log('✓ formula');
    await sql`ALTER TABLE "template_rows" ADD COLUMN IF NOT EXISTS "initial_value" numeric(20, 6)`;
    console.log('✓ initial_value');
    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
