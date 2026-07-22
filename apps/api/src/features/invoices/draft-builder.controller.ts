import { Context } from "hono";
import { db, invoiceDrafts } from "@starter/db";
import { eq, and } from "drizzle-orm";

async function getDraft(c: Context) {
  const draftId = c.req.param("id");
  const organizationId = c.get("organizationId");
  const [draft] = await db.select().from(invoiceDrafts)
    .where(and(eq(invoiceDrafts.id, draftId), eq(invoiceDrafts.organizationId, organizationId)))
    .limit(1);
  return draft;
}

async function updateDraft(id: string, updates: any) {
  const [updated] = await db.update(invoiceDrafts).set(updates).where(eq(invoiceDrafts.id, id)).returning();
  return updated;
}

export class DraftBuilderController {
  static async getSections(c: Context) {
    const draft = await getDraft(c);
    if (!draft) return c.json({ error: "Draft not found" }, 404);
    return c.json(draft.draftSections || []);
  }

  static async getConstants(c: Context) {
    const draft = await getDraft(c);
    if (!draft) return c.json({ error: "Draft not found" }, 404);
    return c.json(draft.draftConstants || {});
  }

  // -- CONSTANTS --
  static async createConstant(c: Context) {
    const draft = await getDraft(c);
    if (!draft) return c.json({ error: "Draft not found" }, 404);
    const body = await c.req.json();
    
    const constants = draft.draftConstants || {};
    if (constants[body.key]) {
      return c.json({ error: "Token key already exists in draft" }, 400);
    }
    
    constants[body.key] = {
      id: crypto.randomUUID(),
      key: body.key,
      value: body.value,
      description: body.description
    };
    
    await updateDraft(draft.id, { draftConstants: constants, lastAutoSavedAt: new Date() });
    return c.json(constants[body.key]);
  }

  static async updateConstant(c: Context) {
    const draft = await getDraft(c);
    if (!draft) return c.json({ error: "Draft not found" }, 404);
    const constantId = c.req.param("constantId");
    const body = await c.req.json();
    
    const constants = draft.draftConstants || {};
    // Find key by id
    const key = Object.keys(constants).find(k => constants[k].id === constantId);
    if (!key) return c.json({ error: "Constant not found" }, 404);
    
    constants[key] = { ...constants[key], ...body };
    await updateDraft(draft.id, { draftConstants: constants, lastAutoSavedAt: new Date() });
    return c.json(constants[key]);
  }

  static async deleteConstant(c: Context) {
    const draft = await getDraft(c);
    if (!draft) return c.json({ error: "Draft not found" }, 404);
    const constantId = c.req.param("constantId");
    
    const constants = draft.draftConstants || {};
    const key = Object.keys(constants).find(k => constants[k].id === constantId);
    if (key) {
      delete constants[key];
      await updateDraft(draft.id, { draftConstants: constants, lastAutoSavedAt: new Date() });
    }
    return c.json({ success: true });
  }

  // -- SECTIONS --
  static async createSection(c: Context) {
    const draft = await getDraft(c);
    if (!draft) return c.json({ error: "Draft not found" }, 404);
    const body = await c.req.json();
    
    const sections = draft.draftSections || [];
    const newSection = {
      id: crypto.randomUUID(),
      displayName: body.displayName,
      sectionToken: body.sectionToken,
      description: body.description,
      displayOrder: sections.length,
      rows: [],
      sectionCharges: []
    };
    
    sections.push(newSection);
    await updateDraft(draft.id, { draftSections: sections, lastAutoSavedAt: new Date() });
    return c.json(newSection);
  }

  static async updateSection(c: Context) {
    const draft = await getDraft(c);
    if (!draft) return c.json({ error: "Draft not found" }, 404);
    const sectionId = c.req.param("sectionId");
    const body = await c.req.json();
    
    const sections = draft.draftSections || [];
    const idx = sections.findIndex((s: any) => s.id === sectionId);
    if (idx === -1) return c.json({ error: "Section not found" }, 404);
    
    sections[idx] = { ...sections[idx], ...body };
    await updateDraft(draft.id, { draftSections: sections, lastAutoSavedAt: new Date() });
    return c.json(sections[idx]);
  }

  static async deleteSection(c: Context) {
    const draft = await getDraft(c);
    if (!draft) return c.json({ error: "Draft not found" }, 404);
    const sectionId = c.req.param("sectionId");
    
    let sections = draft.draftSections || [];
    sections = sections.filter((s: any) => s.id !== sectionId);
    await updateDraft(draft.id, { draftSections: sections, lastAutoSavedAt: new Date() });
    return c.json({ success: true });
  }

  static async reorderSections(c: Context) {
    const draft = await getDraft(c);
    if (!draft) return c.json({ error: "Draft not found" }, 404);
    const body = await c.req.json();
    const { order } = body as { order: { id: string; displayOrder: number }[] };
    
    const sections = draft.draftSections || [];
    for (const s of sections) {
      const match = order.find(o => o.id === s.id);
      if (match) s.displayOrder = match.displayOrder;
    }
    sections.sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0));
    
    await updateDraft(draft.id, { draftSections: sections, lastAutoSavedAt: new Date() });
    return c.json({ success: true });
  }

  // -- ROWS --
  static async createRow(c: Context) {
    const draft = await getDraft(c);
    if (!draft) return c.json({ error: "Draft not found" }, 404);
    const sectionId = c.req.param("sectionId");
    const body = await c.req.json();
    
    const sections = draft.draftSections || [];
    const s = sections.find((s: any) => s.id === sectionId);
    if (!s) return c.json({ error: "Section not found" }, 404);
    
    if (sections.some((sec: any) => sec.rows.some((r: any) => r.rowToken === body.rowToken))) {
      return c.json({ error: "Row token must be unique across all sections" }, 400);
    }
    
    const newRow = {
      id: crypto.randomUUID(),
      sectionId,
      ...body,
      displayOrder: s.rows.length,
      charges: [] // nested row charges
    };
    s.rows.push(newRow);
    
    await updateDraft(draft.id, { draftSections: sections, lastAutoSavedAt: new Date() });
    return c.json(newRow);
  }

  static async updateRow(c: Context) {
    const draft = await getDraft(c);
    if (!draft) return c.json({ error: "Draft not found" }, 404);
    const sectionId = c.req.param("sectionId");
    const rowId = c.req.param("rowId");
    const body = await c.req.json();
    
    const sections = draft.draftSections || [];
    const s = sections.find((s: any) => s.id === sectionId);
    if (!s) return c.json({ error: "Section not found" }, 404);
    
    const rIdx = s.rows.findIndex((r: any) => r.id === rowId);
    if (rIdx === -1) return c.json({ error: "Row not found" }, 404);
    
    if (body.rowToken && body.rowToken !== s.rows[rIdx].rowToken) {
        // Prevent editing rowToken if it's supposed to be immutable for drafts created from templates
        // The user says "Only the row tokens names are immutable." Let's just ignore rowToken updates.
        delete body.rowToken;
    }

    s.rows[rIdx] = { ...s.rows[rIdx], ...body };
    
    await updateDraft(draft.id, { draftSections: sections, lastAutoSavedAt: new Date() });
    return c.json(s.rows[rIdx]);
  }

  static async deleteRow(c: Context) {
    const draft = await getDraft(c);
    if (!draft) return c.json({ error: "Draft not found" }, 404);
    const sectionId = c.req.param("sectionId");
    const rowId = c.req.param("rowId");
    
    const sections = draft.draftSections || [];
    const s = sections.find((s: any) => s.id === sectionId);
    if (s) {
      s.rows = s.rows.filter((r: any) => r.id !== rowId);
      await updateDraft(draft.id, { draftSections: sections, lastAutoSavedAt: new Date() });
    }
    return c.json({ success: true });
  }

  static async reorderRows(c: Context) {
    const draft = await getDraft(c);
    if (!draft) return c.json({ error: "Draft not found" }, 404);
    const sectionId = c.req.param("sectionId");
    const body = await c.req.json();
    const { order } = body as { order: { id: string; displayOrder: number }[] };
    
    const sections = draft.draftSections || [];
    const s = sections.find((s: any) => s.id === sectionId);
    if (s) {
      for (const r of s.rows) {
        const match = order.find(o => o.id === r.id);
        if (match) r.displayOrder = match.displayOrder;
      }
      s.rows.sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0));
      await updateDraft(draft.id, { draftSections: sections, lastAutoSavedAt: new Date() });
    }
    return c.json({ success: true });
  }

  // -- SECTION CHARGES --
  static async createSectionCharge(c: Context) {
    const draft = await getDraft(c);
    if (!draft) return c.json({ error: "Draft not found" }, 404);
    const sectionId = c.req.param("sectionId");
    const body = await c.req.json();
    
    const sections = draft.draftSections || [];
    const s = sections.find((s: any) => s.id === sectionId);
    if (!s) return c.json({ error: "Section not found" }, 404);
    
    const newCharge = {
      id: crypto.randomUUID(),
      sectionId,
      ...body,
      displayOrder: (s.sectionCharges || []).length
    };
    if (!s.sectionCharges) s.sectionCharges = [];
    s.sectionCharges.push(newCharge);
    
    await updateDraft(draft.id, { draftSections: sections, lastAutoSavedAt: new Date() });
    return c.json(newCharge);
  }

  static async updateSectionCharge(c: Context) {
    const draft = await getDraft(c);
    if (!draft) return c.json({ error: "Draft not found" }, 404);
    const sectionId = c.req.param("sectionId");
    const chargeId = c.req.param("chargeId");
    const body = await c.req.json();
    
    const sections = draft.draftSections || [];
    const s = sections.find((s: any) => s.id === sectionId);
    if (!s) return c.json({ error: "Section not found" }, 404);
    
    const cIdx = (s.sectionCharges || []).findIndex((ch: any) => ch.id === chargeId);
    if (cIdx === -1) return c.json({ error: "Charge not found" }, 404);
    
    s.sectionCharges[cIdx] = { ...s.sectionCharges[cIdx], ...body };
    await updateDraft(draft.id, { draftSections: sections, lastAutoSavedAt: new Date() });
    return c.json(s.sectionCharges[cIdx]);
  }

  static async deleteSectionCharge(c: Context) {
    const draft = await getDraft(c);
    if (!draft) return c.json({ error: "Draft not found" }, 404);
    const sectionId = c.req.param("sectionId");
    const chargeId = c.req.param("chargeId");
    
    const sections = draft.draftSections || [];
    const s = sections.find((s: any) => s.id === sectionId);
    if (s && s.sectionCharges) {
      s.sectionCharges = s.sectionCharges.filter((ch: any) => ch.id !== chargeId);
      await updateDraft(draft.id, { draftSections: sections, lastAutoSavedAt: new Date() });
    }
    return c.json({ success: true });
  }
}
