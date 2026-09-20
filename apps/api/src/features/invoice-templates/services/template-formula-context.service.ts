import * as dbModule from "@starter/db";
import {
  decodeFormula as actualDecodeFormula,
  decodeFormulaForEval as actualDecodeFormulaForEval,
  encodeFormula as actualEncodeFormula,
  type RowIdToTokenMap,
  type RowTokenToIdMap,
  type SecIdToTokenMap,
  type SecTokenToIdMap,
  type TplIdToTokenMap,
  type TplTokenToIdMap,
} from "@starter/db/formula-codec";
import { and, eq } from "drizzle-orm";
import { buildConstantIndex } from "../metadata/services/constant-index.service";
import { buildRowIndex } from "../rows/services/row-index.service";
import { buildSectionIndex } from "../sections/services/section-index.service";

export interface TemplateFormulaContext {
  templateId: string;
  organizationId: string;
  rowTokenToId: RowTokenToIdMap;
  rowIdToToken: RowIdToTokenMap;
  secTokenToId: SecTokenToIdMap;
  secIdToToken: SecIdToTokenMap;
  tplTokenToId: TplTokenToIdMap;
  tplIdToToken: TplIdToTokenMap;
  fileFieldTokens: string[];
  globalTokens: string[];
  encode: (formula: string | null | undefined) => string | null;
  decode: (storedFormula: string | null | undefined) => string | null;
  decodeForEval: (storedFormula: string | null | undefined) => string;
}

/**
 * Loads the complete token mapping context for an invoice template.
 * Enables two-way encoding (bare tokens in UI -> prefixed/UUID tokens in DB)
 * and decoding (prefixed/UUID tokens in DB -> bare tokens in UI).
 */
export async function getTemplateFormulaContext(
  templateId: string,
  organizationId?: string,
  tx: any = (dbModule as any).db,
): Promise<TemplateFormulaContext> {
  const dbKeys = Object.keys(dbModule);
  const invoiceTemplates = dbKeys.includes("invoiceTemplates")
    ? (dbModule as any).invoiceTemplates
    : undefined;
  const templateHeaderFields = dbKeys.includes("templateHeaderFields")
    ? (dbModule as any).templateHeaderFields
    : undefined;
  const organizationConfigs = dbKeys.includes("organizationConfigs")
    ? (dbModule as any).organizationConfigs
    : undefined;
  const encodeFn =
    (dbKeys.includes("encodeFormula") ? (dbModule as any).encodeFormula : null) ??
    actualEncodeFormula;
  const decodeFn =
    (dbKeys.includes("decodeFormula") ? (dbModule as any).decodeFormula : null) ??
    actualDecodeFormula;
  const decodeForEvalFn =
    (dbKeys.includes("decodeFormulaForEval") ? (dbModule as any).decodeFormulaForEval : null) ??
    actualDecodeFormulaForEval;

  let orgId = organizationId;
  if (!orgId && tx?.select && invoiceTemplates) {
    try {
      const q = tx
        .select({ orgId: invoiceTemplates.organizationId })
        .from(invoiceTemplates)
        .where(eq(invoiceTemplates.id, templateId));
      const res = typeof q?.limit === "function" ? await q.limit(1) : await q;
      orgId = res?.[0]?.orgId || "";
    } catch {
      orgId = "";
    }
  }

  const fetchHeaderFields = async (): Promise<any[]> => {
    if (!templateHeaderFields || !tx?.select) return [];
    try {
      return await tx
        .select({
          fileFieldKey: templateHeaderFields.fileFieldKey,
          label: templateHeaderFields.label,
        })
        .from(templateHeaderFields)
        .where(eq(templateHeaderFields.templateId, templateId));
    } catch {
      return [];
    }
  };

  const fetchOrgConfigs = async (): Promise<any[]> => {
    if (!orgId || !organizationConfigs || !tx?.select) return [];
    try {
      return await tx
        .select({
          configKey: organizationConfigs.configKey,
        })
        .from(organizationConfigs)
        .where(
          and(
            eq(organizationConfigs.organizationId, orgId),
            eq(organizationConfigs.isFormulaInjectable, true),
          ),
        );
    } catch {
      return [];
    }
  };

  const [rowIdx, secIdx, tplIdx, headerFields, orgConfigs] = await Promise.all([
    buildRowIndex(templateId).catch(() => ({ tokenToId: {}, idToToken: {} })),
    buildSectionIndex(templateId).catch(() => ({ tokenToId: {}, idToToken: {} })),
    buildConstantIndex(templateId).catch(() => ({ tplTokenToId: {}, tplIdToToken: {} })),
    fetchHeaderFields(),
    fetchOrgConfigs(),
  ]);

  const fileFieldTokens: string[] = [];
  for (const hf of headerFields || []) {
    if (hf?.fileFieldKey) {
      fileFieldTokens.push(hf.fileFieldKey.toUpperCase().replace(/^FILE_/, ""));
    } else if (hf?.label) {
      fileFieldTokens.push(
        hf.label
          .toUpperCase()
          .replace(/[^A-Z0-9_]/g, "_")
          .replace(/^FILE_/, ""),
      );
    }
  }

  const globalTokens: string[] = [];
  for (const oc of orgConfigs || []) {
    if (oc?.configKey) {
      globalTokens.push(oc.configKey.replace(/^(GBL_|ORG_)/, ""));
    }
  }

  return {
    templateId,
    organizationId: orgId || "",
    rowTokenToId: rowIdx.tokenToId || {},
    rowIdToToken: rowIdx.idToToken || {},
    secTokenToId: secIdx.tokenToId || {},
    secIdToToken: secIdx.idToToken || {},
    tplTokenToId: tplIdx.tplTokenToId || {},
    tplIdToToken: tplIdx.tplIdToToken || {},
    fileFieldTokens,
    globalTokens,
    encode: (formula: string | null | undefined) =>
      encodeFn(
        formula,
        rowIdx.tokenToId || {},
        secIdx.tokenToId || {},
        tplIdx.tplTokenToId || {},
        fileFieldTokens,
        globalTokens,
      ),
    decode: (storedFormula: string | null | undefined) =>
      decodeFn(
        storedFormula,
        rowIdx.idToToken || {},
        secIdx.idToToken || {},
        tplIdx.tplIdToToken || {},
        fileFieldTokens,
        globalTokens,
      ),
    decodeForEval: (storedFormula: string | null | undefined) =>
      decodeForEvalFn(
        storedFormula,
        rowIdx.idToToken || {},
        secIdx.idToToken || {},
        tplIdx.tplIdToToken || {},
      ),
  };
}
