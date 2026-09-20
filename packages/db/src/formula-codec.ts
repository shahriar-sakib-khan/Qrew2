/**
 * Formula Codec
 *
 * Encodes/decodes row and section token references in formula strings.
 *
/**
 * Formula Codec
 *
 * Encodes/decodes row and section token references in formula strings.
 *
 * Storage format (in DB):   {{$row:UUID}}, {{$sec:UUID}}
 * Display format (in UI):   ROW_TOKEN_NAME, SEC_TOKEN_NAME
 *
 * External tokens (FILE_*, ORG_*, CAT_*) remain as plain text.
 */

export type RowTokenToIdMap = Record<string, string>;
export type RowIdToTokenMap = Record<string, string>;

export type SecTokenToIdMap = Record<string, string>;
export type SecIdToTokenMap = Record<string, string>;

export type TplTokenToIdMap = Record<string, string>;
export type TplIdToTokenMap = Record<string, string>;

const ROW_REF_RE = /\{\{\$row:([0-9a-f-]+)\}\}/gi;
const ROW_TOTAL_REF_RE = /\{\{\$row:([0-9a-f-]+)\}\}_TOTAL/gi;

const SEC_REF_RE = /\{\{\$sec:([0-9a-f-]+)\}\}/gi;
const SEC_TOTAL_REF_RE = /\{\{\$sec:([0-9a-f-]+)\}\}_TOTAL/gi;
const SEC_CHARGES_REF_RE = /\{\{\$sec:([0-9a-f-]+)\}\}_CHARGES/gi;

const TPL_REF_RE = /\{\{\$tpl:([0-9a-f-]+)\}\}/gi;

export function encodeFormula(
  formula: string | null | undefined,
  rowTokenToId: RowTokenToIdMap = {},
  secTokenToId: SecTokenToIdMap = {},
  tplTokenToId: TplTokenToIdMap = {}
): string | null {
  if (!formula) return null;

  let result = formula;

  // Encode Constants (TPL_*)
  const tplTokens = Object.keys(tplTokenToId).sort((a, b) => b.length - a.length);
  for (const token of tplTokens) {
    const id = tplTokenToId[token];
    result = result.replace(new RegExp(`\\b${token}\\b`, 'g'), `{{$tpl:${id}}}`);
  }

  // Encode Sections
  const secTokens = Object.keys(secTokenToId).sort((a, b) => b.length - a.length);
  for (const token of secTokens) {
    const id = secTokenToId[token];
    result = result.replace(new RegExp(`\\b${token}_TOTAL\\b`, 'g'), `{{$sec:${id}}}_TOTAL`);
    result = result.replace(new RegExp(`\\b${token}_CHARGES\\b`, 'g'), `{{$sec:${id}}}_CHARGES`);
    result = result.replace(new RegExp(`\\b${token}\\b`, 'g'), `{{$sec:${id}}}`);
  }

  // Encode Rows
  const rowTokens = Object.keys(rowTokenToId).sort((a, b) => b.length - a.length);
  for (const token of rowTokens) {
    const id = rowTokenToId[token];
    result = result.replace(new RegExp(`\\b${token}_TOTAL\\b`, 'g'), `{{$row:${id}}}_TOTAL`);
    result = result.replace(new RegExp(`\\b${token}\\b`, 'g'), `{{$row:${id}}}`);
  }

  return result;
}

export function decodeFormula(
  storedFormula: string | null | undefined,
  rowIdToToken: RowIdToTokenMap = {},
  secIdToToken: SecIdToTokenMap = {},
  tplIdToToken: TplIdToTokenMap = {}
): string | null {
  if (!storedFormula) return null;

  let result = storedFormula;

  // Decode Constants
  result = result.replace(TPL_REF_RE, (_, id) => {
    const token = tplIdToToken[id];
    return token ? token : `{{$tpl:${id}}}`;
  });

  // Decode Sections
  result = result.replace(SEC_TOTAL_REF_RE, (_, id) => {
    const token = secIdToToken[id];
    return token ? `${token}_TOTAL` : `{{$sec:${id}}}_TOTAL`;
  });
  result = result.replace(SEC_CHARGES_REF_RE, (_, id) => {
    const token = secIdToToken[id];
    return token ? `${token}_CHARGES` : `{{$sec:${id}}}_CHARGES`;
  });
  result = result.replace(SEC_REF_RE, (_, id) => {
    const token = secIdToToken[id];
    return token ? token : `{{$sec:${id}}}`;
  });

  // Decode Rows
  result = result.replace(ROW_TOTAL_REF_RE, (_, id) => {
    const token = rowIdToToken[id];
    return token ? `${token}_TOTAL` : `{{$row:${id}}}_TOTAL`;
  });
  result = result.replace(ROW_REF_RE, (_, id) => {
    const token = rowIdToToken[id];
    return token ? token : `{{$row:${id}}}`;
  });

  return result;
}

export function decodeFormulaForEval(
  storedFormula: string | null | undefined,
  rowIdToToken: RowIdToTokenMap = {},
  secIdToToken: SecIdToTokenMap = {},
  tplIdToToken: TplIdToTokenMap = {}
): string {
  return decodeFormula(storedFormula, rowIdToToken, secIdToToken, tplIdToToken) ?? '';
}
