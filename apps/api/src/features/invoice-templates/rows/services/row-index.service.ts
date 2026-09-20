import { db, templateRows } from "@starter/db";
import { eq } from "drizzle-orm";
import type { RowTokenToIdMap, RowIdToTokenMap } from "@starter/db";

/** Build token↔id lookup maps for all rows in a template. */
export async function buildRowIndex(templateId: string): Promise<{
  tokenToId: RowTokenToIdMap;
  idToToken: RowIdToTokenMap;
}> {
  const rows = await db
    .select({ id: templateRows.id, rowToken: templateRows.rowToken })
    .from(templateRows)
    .where(eq(templateRows.templateId, templateId));

  const tokenToId: RowTokenToIdMap = {};
  const idToToken: RowIdToTokenMap = {};
  for (const row of rows) {
    tokenToId[row.rowToken] = row.id;
    idToToken[row.id] = row.rowToken;
  }
  return { tokenToId, idToToken };
}

/** Convert a label string to SNAKE_CASE token suffix. */
export function toSnakeCase(label: string): string {
  return label
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}
