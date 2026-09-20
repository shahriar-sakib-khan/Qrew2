import { db, templateConstants } from "@starter/db";
import { eq } from "drizzle-orm";
import type { TplTokenToIdMap, TplIdToTokenMap } from "@starter/db";

export async function buildConstantIndex(templateId: string): Promise<{
  tplTokenToId: TplTokenToIdMap;
  tplIdToToken: TplIdToTokenMap;
}> {
  const constants = await db
    .select({ id: templateConstants.id, token: templateConstants.token })
    .from(templateConstants)
    .where(eq(templateConstants.templateId, templateId));

  const tplTokenToId: TplTokenToIdMap = {};
  const tplIdToToken: TplIdToTokenMap = {};
  for (const c of constants) {
    if (c.token) {
      tplTokenToId[c.token] = c.id;
      tplIdToToken[c.id] = c.token;
    }
  }
  return { tplTokenToId, tplIdToToken };
}
