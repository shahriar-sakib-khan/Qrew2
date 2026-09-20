import { db, invoiceDrafts, users, organizations, projects, invoiceTemplates } from "@starter/db";
import { eq, and } from "drizzle-orm";

async function main() {
  try {
    const user = await db.select().from(users).limit(1);
    const org = await db.select().from(organizations).limit(1);
    const proj = await db.select().from(projects).limit(1);
    const tpl = await db.select().from(invoiceTemplates).limit(1);

    if (!user.length || !org.length || !proj.length) {
      console.log("Missing data");
      return;
    }

    console.log("Finding existing...");
    const [existing] = await db.select()
        .from(invoiceDrafts)
        .where(and(
          eq(invoiceDrafts.organizationId, org[0].id),
          eq(invoiceDrafts.projectId, proj[0].id),
          eq(invoiceDrafts.userId, user[0].id)
        ))
        .limit(1);

    if (existing) {
        console.log("Updating existing...", existing.id);
        const [updated] = await db.update(invoiceDrafts)
          .set({
            sourceTemplateId: tpl.length ? tpl[0].id : undefined,
            draftHeaderValues: {},
            draftSections: [],
            lastAutoSavedAt: new Date()
          })
          .where(eq(invoiceDrafts.id, existing.id))
          .returning();
        console.log("Updated:", updated.id);
    } else {
        console.log("Not found existing.");
    }
    
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    process.exit(0);
  }
}

main();
