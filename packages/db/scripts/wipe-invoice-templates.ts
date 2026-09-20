import "dotenv/config";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const sql = postgres(DATABASE_URL);

async function run() {
  console.log("Wiping invoice templates, drafts, and invoices...");
  try {
    await sql`TRUNCATE TABLE 
      "template_row_charges", 
      "template_rows", 
      "template_section_charges", 
      "template_sections", 
      "template_constants", 
      "template_header_fields", 
      "invoice_drafts",
      "invoice_reserved_numbers",
      "invoice_line_items",
      "invoices",
      "invoice_templates" 
      CASCADE;`;
    console.log("✓ Successfully truncated all invoice tables.");
  } catch (err) {
    console.error("Failed to wipe invoice tables:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
