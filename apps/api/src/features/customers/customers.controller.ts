/**
 * customers.controller.ts
 * Manages the buyer (customer) directory for the inventory module.
 * Customers are distinct from `clients` (which act as Suppliers in purchases).
 */

import { customers, db } from "@starter/db";
import { and, eq } from "drizzle-orm";
import { type Context } from "hono";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export class CustomersController {
  static async list(c: Context) {
    const orgId = c.get("organizationId");

    const result = await db.query.customers.findMany({
      where: and(eq(customers.organizationId, orgId), eq(customers.isActive, true)),
      orderBy: (t, { asc }) => [asc(t.name)],
    });

    return c.json(result);
  }

  static async create(c: Context) {
    const orgId = c.get("organizationId");
    const body = await c.req.json();
    const parsed = customerSchema.safeParse(body);
    if (!parsed.success)
      return c.json({ error: "Validation Error", details: parsed.error.format() }, 400);

    const [created] = await db
      .insert(customers)
      .values({
        id: uuidv4(),
        organizationId: orgId,
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        address: parsed.data.address,
        isActive: parsed.data.isActive,
      })
      .returning();

    return c.json(created, 201);
  }

  static async update(c: Context) {
    const orgId = c.get("organizationId");
    const id = c.req.param("id") as string;
    const body = await c.req.json();
    const parsed = customerSchema.safeParse(body);
    if (!parsed.success)
      return c.json({ error: "Validation Error", details: parsed.error.format() }, 400);

    const existing = await db.query.customers.findFirst({
      where: and(eq(customers.id, id), eq(customers.organizationId, orgId)),
    });
    if (!existing) return c.json({ error: "Not Found" }, 404);

    // NOTE FOR TEAMMATE & AGENT:
    // Scoped update query with `and(eq(customers.id, id), eq(customers.organizationId, orgId))`
    // to prevent cross-tenant record mutation.
    const [updated] = await db
      .update(customers)
      .set({
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        address: parsed.data.address,
        isActive: parsed.data.isActive,
      })
      .where(and(eq(customers.id, id), eq(customers.organizationId, orgId)))
      .returning();

    return c.json(updated);
  }

  static async remove(c: Context) {
    const orgId = c.get("organizationId");
    const id = c.req.param("id") as string;

    const existing = await db.query.customers.findFirst({
      where: and(eq(customers.id, id), eq(customers.organizationId, orgId)),
    });
    if (!existing) return c.json({ error: "Not Found" }, 404);

    try {
      // NOTE FOR TEAMMATE & AGENT:
      // Scoped delete query with `and(eq(customers.id, id), eq(customers.organizationId, orgId))`
      // to maintain strict tenant boundaries.
      await db
        .delete(customers)
        .where(and(eq(customers.id, id), eq(customers.organizationId, orgId)));
      return c.json({ success: true });
    } catch (err: any) {
      // FK violation: customer has associated sales — use soft-delete instead.
      if (err?.code === "23503") {
        return c.json(
          { error: "Cannot delete a customer that has sales history. Deactivate them instead." },
          409,
        );
      }
      throw err;
    }
  }
}
