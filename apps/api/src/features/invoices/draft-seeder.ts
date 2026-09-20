import { db, templateSections, templateRows, templateRowCharges, templateSectionCharges, templateConstants, templateHeaderFields, projects, clients } from "@starter/db";
import { eq, asc, inArray, and } from "drizzle-orm";

export class DraftSeeder {
  /**
   * Reads a template and all its relations from the database and returns
   * the JSON structures for `draftSections`, `draftConstants`, `draftHeaderValues`, and `draftHeaderFields`.
   */
  static async hydrateFromTemplate(templateId: string, projectId?: string, organizationId?: string) {
    // 1. Fetch template constants
    const tConstants = await db.select().from(templateConstants)
      .where(eq(templateConstants.templateId, templateId));
    
    const draftConstants: Record<string, any> = {};
    for (const tc of tConstants) {
      draftConstants[tc.token] = {
        id: crypto.randomUUID(), // New UUIDs for draft instances
        key: tc.token,
        value: tc.defaultValue,
        valueType: tc.valueType,
        description: tc.name
      };
    }

    // 2. Fetch template header fields to initialize draftHeaderValues if needed
    const tHeaders = await db.select().from(templateHeaderFields)
      .where(eq(templateHeaderFields.templateId, templateId))
      .orderBy(asc(templateHeaderFields.sortOrder));
    
    // Fetch project if provided to populate header values
    let project: any = null;
    if (projectId && organizationId) {
       const [proj] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId))).limit(1);
       if (proj) {
           project = proj;
           const [client] = await db.select().from(clients).where(eq(clients.id, project.clientId)).limit(1);
           project.client = client;
       }
    }

    const draftHeaderValues: Record<string, string> = {};
    for (const th of tHeaders) {
      let val = "";
      if (project) {
        if (th.fileFieldKey === "clientId") val = project.client?.name || "";
        else if (th.fileFieldKey === "name" || th.fileFieldKey === "status") val = project[th.fileFieldKey] || "";
        else if (th.fileFieldKey && project.customFields) val = (project.customFields as any)[th.fileFieldKey] || "";
      }
      draftHeaderValues[th.id] = String(val ?? "");
    }

    // 3. Fetch template sections
    const tSections = await db.select().from(templateSections)
      .where(eq(templateSections.templateId, templateId))
      .orderBy(asc(templateSections.sortOrder));

    // Fetch related rows and charges
    const tRows = await db.select().from(templateRows)
      .where(eq(templateRows.templateId, templateId))
      .orderBy(asc(templateRows.sortOrder));
    
    const rowIds = tRows.map(r => r.id);
    let tRowCharges: any[] = [];
    if (rowIds.length > 0) {
      tRowCharges = await db.select().from(templateRowCharges)
        .where(inArray(templateRowCharges.rowId, rowIds))
        .orderBy(asc(templateRowCharges.sortOrder));
    }
    
    const tSectionCharges = await db.select().from(templateSectionCharges)
      .where(eq(templateSectionCharges.templateId, templateId))
      .orderBy(asc(templateSectionCharges.sortOrder));

    const draftSections: any[] = [];

    // ── Build old-template-rowId → new-draft-rowId map BEFORE processing rows.
    // Template formulas store row references as {{$row:TEMPLATE_ROW_UUID}}.
    // The draft assigns new UUIDs to every row, so we must remap all formula
    // strings to point to the new draft UUIDs before saving.
    const oldIdToNewId: Record<string, string> = {};
    for (const tr of tRows) {
      oldIdToNewId[tr.id] = crypto.randomUUID();
    }

    /** Replace every {{$row:OLD_UUID}} occurrence with {{$row:NEW_UUID}}. */
    function remapFormula(formula: string | null | undefined): string | null {
      if (!formula) return formula ?? null;
      return formula.replace(/\{\{\$row:([^}]+)\}\}/g, (_, id) => {
        return `{{$row:${oldIdToNewId[id] ?? id}}}`;
      });
    }

    for (const ts of tSections) {
      const sectionId = crypto.randomUUID();
      
      const rows = tRows.filter(r => r.sectionId === ts.id).map(tr => {
        const rowId = oldIdToNewId[tr.id]; // use the pre-assigned new ID
        
        const charges = tRowCharges.filter(rc => rc.rowId === tr.id).map(trc => ({
          id: crypto.randomUUID(),
          chargeToken: trc.chargeToken,
          label: trc.label,
          subDescription: trc.subDescription,
          qualifier: trc.qualifier,
          tags: trc.tags || [],
          formula: remapFormula(trc.formula), // remap charge formulas too
          sortOrder: trc.sortOrder
        }));

        return {
          id: rowId,
          sectionId,
          parentLabel: tr.parentLabel,
          rowToken: tr.rowToken,
          description: tr.description,
          valueType: tr.valueType,
          formula: remapFormula(tr.formula), // remap row formula
          initialValue: tr.initialValue,
          sortOrder: tr.sortOrder,
          charges
        };
      });

      const sectionCharges = tSectionCharges.filter(sc => sc.sectionId === ts.id).map(tsc => ({
        id: crypto.randomUUID(),
        sectionId,
        chargeToken: tsc.chargeToken,
        label: tsc.label,
        subDescription: tsc.subDescription,
        qualifier: tsc.qualifier,
        tags: tsc.tags || [],
        formulaBase: tsc.formulaBase,
        formulaRest: tsc.formulaRest,
        sortOrder: tsc.sortOrder
      }));

      draftSections.push({
        id: sectionId,
        displayName: ts.displayName,
        sectionToken: ts.sectionToken,
        description: ts.description,
        sortOrder: ts.sortOrder,
        rows,
        sectionCharges
      });
    }

    return {
      draftSections,
      draftConstants,
      draftHeaderValues,
      draftHeaderFields: tHeaders
    };
  }
}
