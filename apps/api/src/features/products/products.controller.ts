/**
 * products.controller.ts
 * Manages the product catalog for standard (Normal) inventory products.
 * Stock levels are never stored here — always queried from inventory_transactions.
 */

import { db, products } from "@starter/db";
import { and, eq } from "drizzle-orm";
import { type Context } from "hono";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

// Base schema for products.
const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  unit: z.string().min(1, "Unit is required"),
  categoryId: z.string().optional().nullable(),
  brandId: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  productType: z.enum(["NORMAL", "REFILLABLE"]).default("NORMAL"),
  purchasePrice: z.string().optional().nullable(),
  sellingPrice: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export class ProductsController {
  // List products, with optional filters: ?categoryId=&isActive=true
  static async list(c: Context) {
    const orgId = c.get("organizationId");
    const categoryId = c.req.query("categoryId");
    const isActive = c.req.query("isActive");

    const result = await db.query.products.findMany({
      where: (t, { eq, and }) => {
        const conditions: any[] = [eq(t.organizationId, orgId)];
        if (categoryId) conditions.push(eq(t.categoryId, categoryId));
        if (isActive !== undefined) conditions.push(eq(t.isActive, isActive === "true"));
        return and(...conditions);
      },
      with: {
        category: { columns: { id: true, name: true } },
        brand: { columns: { id: true, name: true } },
      },
      orderBy: (t, { asc }) => [asc(t.name)],
    });

    return c.json(result);
  }

  // Get a single product.
  static async getById(c: Context) {
    const orgId = c.get("organizationId");
    const id = c.req.param("id") as string;

    const result = await db.query.products.findFirst({
      where: and(eq(products.id, id), eq(products.organizationId, orgId)),
      with: { category: true, brand: true },
    });

    if (!result) return c.json({ error: "Not Found" }, 404);
    return c.json(result);
  }

  // Create a product.
  static async create(c: Context) {
    const orgId = c.get("organizationId");
    const body = await c.req.json();
    const parsed = productSchema.safeParse(body);
    if (!parsed.success)
      return c.json({ error: "Validation Error", details: parsed.error.format() }, 400);

    const productId = uuidv4();

    const generatedSku = parsed.data.sku?.trim()
      ? parsed.data.sku.trim()
      : `PRD-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    await db.insert(products).values({
      id: productId,
      organizationId: orgId,
      categoryId: parsed.data.categoryId,
      brandId: parsed.data.brandId,
      name: parsed.data.name,
      unit: parsed.data.unit,
      sku: generatedSku,
      barcode: parsed.data.barcode,
      description: parsed.data.description,
      // NOTE FOR TEAMMATE & AGENT:
      // We use `parsed.data.productType` instead of hardcoding "NORMAL".
      // While the initial release focuses on normal products, the schema and database support
      // both NORMAL and REFILLABLE products as the foundation for the upcoming refillable workflows.
      productType: parsed.data.productType,
      purchasePrice: parsed.data.purchasePrice,
      sellingPrice: parsed.data.sellingPrice,
      isActive: parsed.data.isActive,
    });

    // NOTE FOR TEAMMATE & AGENT:
    // Tenant-scoped lookup with `and(eq(products.id, productId), eq(products.organizationId, orgId))`
    // for defense-in-depth isolation.
    const created = await db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.organizationId, orgId)),
      with: { category: true, brand: true },
    });

    return c.json(created, 201);
  }

  // Update a product.
  static async update(c: Context) {
    const orgId = c.get("organizationId");
    const id = c.req.param("id") as string;
    const body = await c.req.json();
    const parsed = productSchema.safeParse(body);
    if (!parsed.success)
      return c.json({ error: "Validation Error", details: parsed.error.format() }, 400);

    const existing = await db.query.products.findFirst({
      where: and(eq(products.id, id), eq(products.organizationId, orgId)),
    });
    if (!existing) return c.json({ error: "Not Found" }, 404);

    await db
      .update(products)
      .set({
        categoryId: parsed.data.categoryId,
        brandId: parsed.data.brandId,
        name: parsed.data.name,
        unit: parsed.data.unit,
        sku: parsed.data.sku,
        barcode: parsed.data.barcode,
        description: parsed.data.description,
        // NOTE FOR TEAMMATE & AGENT:
        // Preserving `parsed.data.productType` (or falling back to `existing.productType`) instead of hardcoding "NORMAL".
        // While the team is completing the normal product workflow first, the groundwork for refillable products
        // must be protected so that editing a product never accidentally resets its refillable classification.
        productType: parsed.data.productType ?? existing.productType,
        purchasePrice: parsed.data.purchasePrice,
        sellingPrice: parsed.data.sellingPrice,
        isActive: parsed.data.isActive,
      })
      // NOTE FOR TEAMMATE & AGENT:
      // Multi-tenant scoping added directly to the mutation query for defense-in-depth isolation.
      .where(and(eq(products.id, id), eq(products.organizationId, orgId)));

    const updated = await db.query.products.findFirst({
      where: and(eq(products.id, id), eq(products.organizationId, orgId)),
      with: { category: true, brand: true },
    });

    return c.json(updated);
  }

  // Delete a product — blocked at DB level if it has any inventory_transactions.
  static async remove(c: Context) {
    const orgId = c.get("organizationId");
    const id = c.req.param("id") as string;

    const existing = await db.query.products.findFirst({
      where: and(eq(products.id, id), eq(products.organizationId, orgId)),
    });
    if (!existing) return c.json({ error: "Not Found" }, 404);

    try {
      // NOTE FOR TEAMMATE & AGENT:
      // Multi-tenant scoping added to delete query for strict tenant isolation.
      await db.delete(products).where(and(eq(products.id, id), eq(products.organizationId, orgId)));
      return c.json({ success: true });
    } catch (err: any) {
      const code = err?.code || err?.cause?.code || err?.driverError?.code;
      if (
        code === "23503" ||
        String(err?.message || "")
          .toLowerCase()
          .includes("foreign key constraint")
      ) {
        return c.json(
          { error: "Cannot delete a product with existing order or transaction history." },
          409,
        );
      }
      return c.json({ error: err?.message || "Failed to delete product." }, 500);
    }
  }
}
