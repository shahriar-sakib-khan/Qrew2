/**
 * Formula Codec
 *
 * Encodes/decodes row, section, constant, file field, and global config tokens.
 *
 * Storage format (in DB):
 *   {{$row:UUID}}          → ROW_TOKEN (Total)
 *   {{$row:UUID}}_BASE     → ROW_TOKEN_BASE (Base)
 *   {{$row:UUID}}_CHARGES  → ROW_TOKEN_CHARGES (Charges Sum)
 *   {{$sec:UUID}}          → SEC_TOKEN (Total)
 *   {{$sec:UUID}}_BASE     → SEC_TOKEN_BASE (Base)
 *   {{$sec:UUID}}_CHARGES  → SEC_TOKEN_CHARGES (Charges Sum)
 *   {{$tpl:UUID}}          → TPL_TOKEN (in DB) / TPL_<TOKEN> (in engine)
 *   FILE_<TOKEN>           → External project file field (e.g. FILE_CUSTOM1, FILE_GRT)
 *   GBL_<TOKEN>            → Organization-wide global constant (e.g. GBL_G1, GBL_VAT_RATE)
 *   CAT_<TOKEN> / EXP_<TOKEN> → Expense category sums
 *
 * Display format (in UI):
 *   Bare tokens (e.g. G1, CUSTOM1, T1, PORT_DUES, SEC_PORT), visually distinguished by colors.
 */

export type RowTokenToIdMap = Record<string, string>;
export type RowIdToTokenMap = Record<string, string>;

export type SecTokenToIdMap = Record<string, string>;
export type SecIdToTokenMap = Record<string, string>;

export type TplTokenToIdMap = Record<string, string>;
export type TplIdToTokenMap = Record<string, string>;

const ROW_REF_RE = /\{\{\$row:([a-zA-Z0-9_-]+)\}\}/gi;
const ROW_BASE_REF_RE = /\{\{\$row:([a-zA-Z0-9_-]+)\}\}_BASE/gi;
const ROW_TOTAL_REF_RE = /\{\{\$row:([a-zA-Z0-9_-]+)\}\}_TOTAL/gi;
const ROW_CHARGES_REF_RE = /\{\{\$row:([a-zA-Z0-9_-]+)\}\}_CHARGES/gi;

const SEC_REF_RE = /\{\{\$sec:([a-zA-Z0-9_-]+)\}\}/gi;
const SEC_BASE_REF_RE = /\{\{\$sec:([a-zA-Z0-9_-]+)\}\}_BASE/gi;
const SEC_TOTAL_REF_RE = /\{\{\$sec:([a-zA-Z0-9_-]+)\}\}_TOTAL/gi;
const SEC_CHARGES_REF_RE = /\{\{\$sec:([a-zA-Z0-9_-]+)\}\}_CHARGES/gi;

const TPL_REF_RE = /\{\{\$tpl:([a-zA-Z0-9_-]+)\}\}/gi;

export function encodeFormula(
  formula: string | null | undefined,
  rowTokenToId: RowTokenToIdMap = {},
  secTokenToId: SecTokenToIdMap = {},
  tplTokenToId: TplTokenToIdMap = {},
  fileFieldTokens: string[] = [],
  globalTokens: string[] = [],
): string | null {
  if (!formula) return null;

  let result = formula;

  // Encode Constants (TPL_*)
  const tplTokens = Object.keys(tplTokenToId).sort((a, b) => b.length - a.length);
  for (const token of tplTokens) {
    const id = tplTokenToId[token];
    result = result.replace(new RegExp(`\\b${token}\\b`, "g"), `{{$tpl:${id}}}`);
  }

  // Encode Sections (Encode longer suffixes _BASE, _CHARGES, _TOTAL first!)
  const secTokens = Object.keys(secTokenToId).sort((a, b) => b.length - a.length);
  for (const token of secTokens) {
    const id = secTokenToId[token];
    result = result.replace(new RegExp(`\\b${token}_BASE\\b`, "g"), `{{$sec:${id}}}_BASE`);
    result = result.replace(new RegExp(`\\b${token}_CHARGES\\b`, "g"), `{{$sec:${id}}}_CHARGES`);
    result = result.replace(new RegExp(`\\b${token}_TOTAL\\b`, "g"), `{{$sec:${id}}}`);
    result = result.replace(new RegExp(`\\b${token}\\b`, "g"), `{{$sec:${id}}}`);
  }

  // Encode Rows (Encode longer suffixes _BASE, _CHARGES, _TOTAL first!)
  const rowTokens = Object.keys(rowTokenToId).sort((a, b) => b.length - a.length);
  for (const token of rowTokens) {
    const id = rowTokenToId[token];
    result = result.replace(new RegExp(`\\b${token}_BASE\\b`, "g"), `{{$row:${id}}}_BASE`);
    result = result.replace(new RegExp(`\\b${token}_CHARGES\\b`, "g"), `{{$row:${id}}}_CHARGES`);
    result = result.replace(new RegExp(`\\b${token}_TOTAL\\b`, "g"), `{{$row:${id}}}`);
    result = result.replace(new RegExp(`\\b${token}\\b`, "g"), `{{$row:${id}}}`);
  }

  // Encode File Fields (bare token -> FILE_<TOKEN>)
  const sortedFileTokens = [...fileFieldTokens].sort((a, b) => b.length - a.length);
  for (const token of sortedFileTokens) {
    const clean = token.replace(/^FILE_/, "");
    result = result.replace(new RegExp(`(?<!FILE_)\\b${clean}\\b`, "g"), `FILE_${clean}`);
  }

  // Encode Global Constants (bare token -> GBL_<TOKEN>)
  const sortedGlobalTokens = [...globalTokens].sort((a, b) => b.length - a.length);
  for (const token of sortedGlobalTokens) {
    const clean = token.replace(/^(GBL_|ORG_)/, "");
    result = result.replace(new RegExp(`(?<!GBL_)\\b${clean}\\b`, "g"), `GBL_${clean}`);
  }

  return result;
}

export function decodeFormula(
  storedFormula: string | null | undefined,
  rowIdToToken: RowIdToTokenMap = {},
  secIdToToken: SecIdToTokenMap = {},
  tplIdToToken: TplIdToTokenMap = {},
  fileFieldTokens?: string[],
  globalTokens?: string[],
): string | null {
  if (!storedFormula) return null;

  let result = storedFormula;

  // Decode Constants
  result = result.replace(TPL_REF_RE, (_, id) => {
    const token = tplIdToToken[id];
    return token ? token : `{{$tpl:${id}}}`;
  });

  // Decode Sections
  result = result.replace(SEC_BASE_REF_RE, (_, id) => {
    const token = secIdToToken[id];
    return token ? `${token}_BASE` : `{{$sec:${id}}}_BASE`;
  });
  result = result.replace(SEC_CHARGES_REF_RE, (_, id) => {
    const token = secIdToToken[id];
    return token ? `${token}_CHARGES` : `{{$sec:${id}}}_CHARGES`;
  });
  result = result.replace(SEC_TOTAL_REF_RE, (_, id) => {
    const token = secIdToToken[id];
    return token ? token : `{{$sec:${id}}}`;
  });
  result = result.replace(SEC_REF_RE, (_, id) => {
    const token = secIdToToken[id];
    return token ? token : `{{$sec:${id}}}`;
  });

  // Decode Rows
  result = result.replace(ROW_BASE_REF_RE, (_, id) => {
    const token = rowIdToToken[id];
    return token ? `${token}_BASE` : `{{$row:${id}}}_BASE`;
  });
  result = result.replace(ROW_CHARGES_REF_RE, (_, id) => {
    const token = rowIdToToken[id];
    return token ? `${token}_CHARGES` : `{{$row:${id}}}_CHARGES`;
  });
  result = result.replace(ROW_TOTAL_REF_RE, (_, id) => {
    const token = rowIdToToken[id];
    return token ? token : `{{$row:${id}}}`;
  });
  result = result.replace(ROW_REF_RE, (_, id) => {
    const token = rowIdToToken[id];
    return token ? token : `{{$row:${id}}}`;
  });

  // Decode File Fields (FILE_<TOKEN> -> bare <TOKEN>)
  if (fileFieldTokens && fileFieldTokens.length > 0) {
    const sortedFileTokens = [...fileFieldTokens].sort((a, b) => b.length - a.length);
    for (const token of sortedFileTokens) {
      const clean = token.replace(/^FILE_/, "");
      result = result.replace(new RegExp(`\\bFILE_${clean}\\b`, "g"), clean);
    }
  } else {
    // Strip FILE_ prefix generally
    result = result.replace(/\bFILE_([A-Z0-9_]+)\b/g, "$1");
  }

  // Decode Global Constants (GBL_<TOKEN> or legacy ORG_<TOKEN> -> bare <TOKEN>)
  if (globalTokens && globalTokens.length > 0) {
    const sortedGlobalTokens = [...globalTokens].sort((a, b) => b.length - a.length);
    for (const token of sortedGlobalTokens) {
      const clean = token.replace(/^(GBL_|ORG_)/, "");
      result = result.replace(new RegExp(`\\b(?:GBL_|ORG_)${clean}\\b`, "g"), clean);
    }
  } else {
    // Strip GBL_ or ORG_ prefix generally
    result = result.replace(/\b(?:GBL_|ORG_)([A-Z0-9_]+)\b/g, "$1");
  }

  return result;
}

export function decodeFormulaForEval(
  storedFormula: string | null | undefined,
  rowIdToToken: RowIdToTokenMap = {},
  secIdToToken: SecIdToTokenMap = {},
  tplIdToToken: TplIdToTokenMap = {},
): string {
  if (!storedFormula) return "";

  let result = storedFormula;

  // Constants decoded to TPL_<TOKEN> (matching backend calculation scope)
  result = result.replace(TPL_REF_RE, (_, id) => {
    const token = tplIdToToken[id];
    return token ? `TPL_${token.replace(/^TPL_/, "")}` : `{{$tpl:${id}}}`;
  });

  // Sections
  result = result.replace(SEC_BASE_REF_RE, (_, id) => {
    const token = secIdToToken[id];
    return token ? `${token}_BASE` : `{{$sec:${id}}}_BASE`;
  });
  result = result.replace(SEC_CHARGES_REF_RE, (_, id) => {
    const token = secIdToToken[id];
    return token ? `${token}_CHARGES` : `{{$sec:${id}}}_CHARGES`;
  });
  result = result.replace(SEC_TOTAL_REF_RE, (_, id) => {
    const token = secIdToToken[id];
    return token ? token : `{{$sec:${id}}}`;
  });
  result = result.replace(SEC_REF_RE, (_, id) => {
    const token = secIdToToken[id];
    return token ? token : `{{$sec:${id}}}`;
  });

  // Rows
  result = result.replace(ROW_BASE_REF_RE, (_, id) => {
    const token = rowIdToToken[id];
    return token ? `${token}_BASE` : `{{$row:${id}}}_BASE`;
  });
  result = result.replace(ROW_CHARGES_REF_RE, (_, id) => {
    const token = rowIdToToken[id];
    return token ? `${token}_CHARGES` : `{{$row:${id}}}_CHARGES`;
  });
  result = result.replace(ROW_TOTAL_REF_RE, (_, id) => {
    const token = rowIdToToken[id];
    return token ? token : `{{$row:${id}}}`;
  });
  result = result.replace(ROW_REF_RE, (_, id) => {
    const token = rowIdToToken[id];
    return token ? token : `{{$row:${id}}}`;
  });

  // FILE_* and GBL_* remain intact with prefixes for the engine
  return result;
}
