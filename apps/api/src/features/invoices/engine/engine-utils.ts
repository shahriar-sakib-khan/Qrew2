import {
  db,
  type RowIdToTokenMap,
  type SecIdToTokenMap,
  type TplIdToTokenMap,
  templateConstants,
  templateRowCharges,
  templateRows,
  templateSectionCharges,
  templateSections,
} from "@starter/db";
import { eq, inArray } from "drizzle-orm";
import { DagValidatorService } from "./dag-validator.service";
import { type DagValidationResult, type EvaluatorSection } from "./types";

export async function validateTemplateDag(
  templateId: string,
  tx: any = db,
): Promise<DagValidationResult> {
  const [dbSections, dbRows, dbSectionCharges, dbConstants] = await Promise.all([
    tx
      .select()
      .from(templateSections)
      .where(eq(templateSections.templateId, templateId))
      .orderBy(templateSections.sortOrder),
    tx
      .select()
      .from(templateRows)
      .where(eq(templateRows.templateId, templateId))
      .orderBy(templateRows.sortOrder),
    tx
      .select()
      .from(templateSectionCharges)
      .where(eq(templateSectionCharges.templateId, templateId))
      .orderBy(templateSectionCharges.sortOrder),
    tx.select().from(templateConstants).where(eq(templateConstants.templateId, templateId)),
  ]);

  const rowIds = dbRows.map((r: any) => r.id);
  const dbRowCharges =
    rowIds.length > 0
      ? await tx
          .select()
          .from(templateRowCharges)
          .where(inArray(templateRowCharges.rowId, rowIds))
          .orderBy(templateRowCharges.sortOrder)
      : [];

  const idToToken: RowIdToTokenMap = {};
  for (const row of dbRows) {
    idToToken[row.id] = row.rowToken;
  }

  const secIdToToken: SecIdToTokenMap = {};
  for (const sec of dbSections) {
    if (sec.sectionToken) secIdToToken[sec.id] = `SEC_${sec.sectionToken}`;
  }

  const tplIdToToken: TplIdToTokenMap = {};
  for (const c of dbConstants) {
    if (c.token) tplIdToToken[c.id] = c.token;
  }

  const evaluatorSections: EvaluatorSection[] = dbSections.map((sec: any) => {
    const secRows = dbRows
      .filter((r: any) => r.sectionId === sec.id)
      .map((row: any) => ({
        id: row.id,
        rowToken: row.rowToken,
        label: row.label,
        sectionId: sec.id,
        valueType: row.valueType,
        formula: row.formula ?? undefined,
        initialValue: row.initialValue ?? undefined,
        manualValue: null,
        sortOrder: row.sortOrder,
        charges: dbRowCharges
          .filter((rc: any) => rc.rowId === row.id)
          .map((rc: any) => ({
            id: rc.id,
            chargeToken: rc.chargeToken ?? undefined,
            label: rc.label,
            formula: rc.formula ?? undefined,
            sortOrder: rc.sortOrder,
          })),
      }));

    const sCharges = dbSectionCharges
      .filter((sc: any) => sc.sectionId === sec.id)
      .map((sc: any) => ({
        id: sc.id,
        chargeToken: sc.chargeToken,
        label: sc.label,
        formula: sc.formula ?? undefined,
        sortOrder: sc.sortOrder,
      }));

    return {
      id: sec.id,
      sectionToken: sec.sectionToken,
      sortOrder: sec.sortOrder,
      rows: secRows as any,
      sectionCharges: sCharges as any,
    };
  });

  return DagValidatorService.validate(
    evaluatorSections as any,
    new Set(),
    idToToken,
    secIdToToken,
    tplIdToToken,
  );
}
