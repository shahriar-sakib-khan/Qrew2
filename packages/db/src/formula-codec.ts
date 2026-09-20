/**
 * Formula Codec
 *
 * Encodes/decodes row token references in formula strings.
 *
 * Storage format (in DB):   {{$row:UUID}}
 * Display format (in UI):   ROW_TOKEN_NAME
 *
 * Only row-level tokens are UUID-encoded. External tokens (FILE_*, ORG_*, CAT_*, SEC_*)
 * remain as plain text since they are immutable identifiers.
 *
 * ENCODE: called before saving to DB — replaces token names with UUIDs
 * DECODE: called after reading from DB — replaces UUIDs with current token names
 */

/** Map of rowToken (e.g. PORT_DUES) → rowId (UUID) */
export type RowTokenToIdMap = Record<string, string>;
/** Map of rowId (UUID) → rowToken (e.g. PORT_DUES) */
export type RowIdToTokenMap = Record<string, string>;

/** Regex that matches {{$row:UUID}} patterns in stored formulas */
const ROW_REF_RE = /\{\{\$row:([0-9a-f-]+)\}\}/gi;
/** Regex that matches {{$row:UUID}}_TOTAL patterns */
const ROW_TOTAL_REF_RE = /\{\{\$row:([0-9a-f-]+)\}\}_TOTAL/gi;

/**
 * Encode a formula for DB storage.
 * Replaces ROW_TOKEN and ROW_TOKEN_TOTAL with {{$row:uuid}} and {{$row:uuid}}_TOTAL.
 *
 * @param formula     - The raw formula string as typed by the user (bare token names)
 * @param tokenToId   - Map of rowToken → rowId
 */
export function encodeFormula(
  formula: string | null | undefined,
  tokenToId: RowTokenToIdMap
): string | null {
  if (!formula) return null;

  let result = formula;

  // Sort tokens longest-first to avoid partial replacements
  const tokens = Object.keys(tokenToId).sort((a, b) => b.length - a.length);

  for (const token of tokens) {
    const id = tokenToId[token];
    // Replace TOKEN_TOTAL before TOKEN (so PORT_DUES_TOTAL isn't half-replaced)
    result = result.replace(
      new RegExp(`\\b${token}_TOTAL\\b`, 'g'),
      `{{$row:${id}}}_TOTAL`
    );
    result = result.replace(
      new RegExp(`\\b${token}\\b`, 'g'),
      `{{$row:${id}}}`
    );
  }

  return result;
}

/**
 * Decode a stored formula for display.
 * Replaces {{$row:uuid}} and {{$row:uuid}}_TOTAL with current token names.
 *
 * @param storedFormula - The formula as stored in DB
 * @param idToToken     - Map of rowId → rowToken
 */
export function decodeFormula(
  storedFormula: string | null | undefined,
  idToToken: RowIdToTokenMap
): string | null {
  if (!storedFormula) return null;

  // Replace {{$row:uuid}}_TOTAL first
  let result = storedFormula.replace(ROW_TOTAL_REF_RE, (_, id) => {
    const token = idToToken[id];
    return token ? `${token}_TOTAL` : `{{$row:${id}}}_TOTAL`; // fallback: keep raw if not found
  });

  // Then replace {{$row:uuid}}
  result = result.replace(ROW_REF_RE, (_, id) => {
    const token = idToToken[id];
    return token ? token : `{{$row:${id}}}`; // fallback
  });

  return result;
}

/**
 * Decode a stored formula for engine evaluation.
 * Same as decodeFormula but returns empty string instead of null.
 */
export function decodeFormulaForEval(
  storedFormula: string | null | undefined,
  idToToken: RowIdToTokenMap
): string {
  return decodeFormula(storedFormula, idToToken) ?? '';
}
