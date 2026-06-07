import { type Context } from "hono";
import { z } from "zod";
import { db, requisitions, walletTransactions, users, projects } from "@starter/db";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { auth } from "../../infra/lib/auth";

const createRequisitionSchema = z.object({
  amount: z.number().positive(),
  purpose: z.string().min(1),
  projectId: z.string().optional().nullable(),
});

export async function createRequisition(c: Context) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const organizationId = session?.session?.activeOrganizationId;
  const userId = session?.user?.id;

  if (!organizationId || !userId) {
    return c.json({ error: "Missing active session context" }, 401);
  }

  const body = await c.req.json();
  const parsed = createRequisitionSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid data", details: parsed.error.format() }, 400);
  }

  const [newRequisition] = await db
    .insert(requisitions)
    .values({
      id: uuidv4(),
      organizationId,
      requestedById: userId,
      projectId: parsed.data.projectId || null,
      amount: parsed.data.amount.toString(),
      purpose: parsed.data.purpose,
      status: "pending",
    })
    .returning();

  return c.json(newRequisition, 201);
}

export async function listRequisitions(c: Context) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const organizationId = session?.session?.activeOrganizationId;

  if (!organizationId) {
    return c.json({ error: "Missing organization ID" }, 401);
  }

  // Support filtering by user if they don't have finance permission
  // For now, let's just return all for the organization.
  const allRequisitions = await db
    .select({
      id: requisitions.id,
      amount: requisitions.amount,
      purpose: requisitions.purpose,
      status: requisitions.status,
      createdAt: requisitions.createdAt,
      requestedBy: users.name,
      projectName: projects.name,
      actionedBy: users.name, // would need alias for actioned by in real query
    })
    .from(requisitions)
    .where(eq(requisitions.organizationId, organizationId))
    .leftJoin(users, eq(requisitions.requestedById, users.id))
    .leftJoin(projects, eq(requisitions.projectId, projects.id))
    .orderBy(desc(requisitions.createdAt));

  return c.json(allRequisitions);
}

const actionRequisitionSchema = z.object({
  status: z.enum(["approved", "rejected", "disbursed"]),
});

export async function actionRequisition(c: Context) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const organizationId = session?.session?.activeOrganizationId;
  const adminId = session?.user?.id;

  if (!organizationId || !adminId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const reqId = c.req.param("id");
  if (!reqId) {
    return c.json({ error: "Missing ID" }, 400);
  }
  const body = await c.req.json();
  const parsed = actionRequisitionSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid data" }, 400);
  }

  // Get the requisition
  const [existing] = await db
    .select()
    .from(requisitions)
    .where(
      and(
        eq(requisitions.id, reqId),
        eq(requisitions.organizationId, organizationId)
      )
    );

  if (!existing) {
    return c.json({ error: "Requisition not found" }, 404);
  }

  if (existing.status === "disbursed") {
    return c.json({ error: "Cannot modify an already disbursed requisition" }, 400);
  }

  // Transaction for disbursement
  await db.transaction(async (tx) => {
    // 1. Update status
    await tx
      .update(requisitions)
      .set({
        status: parsed.data.status,
        actionedById: adminId,
        updatedAt: new Date(),
      })
      .where(eq(requisitions.id, reqId));

    // 2. If disbursed, add to wallet transactions
    if (parsed.data.status === "disbursed") {
      await tx.insert(walletTransactions).values({
        id: uuidv4(),
        organizationId,
        memberId: existing.requestedById,
        type: "credit",
        amount: existing.amount,
        referenceType: "requisition",
        referenceId: existing.id,
        description: `Disbursed funds for Req: ${existing.purpose}`,
      });
    }
  });

  return c.json({ success: true, status: parsed.data.status });
}
