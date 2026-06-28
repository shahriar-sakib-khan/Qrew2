import { type Context } from "hono";
import { z } from "zod";
import { db, organizationConfigs, templateRows, templateRowComponents, invoiceTemplates } from "@starter/db";
import { eq, and, like } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { auth } from "../../infra/lib/auth";

const createConfigSchema = z.object({
  configKey: z.string().min(1).regex(/^[A-Z0-9_]+$/, "Must be UPPER_SNAKE_CASE"),
  configValue: z.string(),
  displayLabel: z.string().min(1),
  valueType: z.enum(["number", "percentage", "currency_rate", "text"]),
  isFormulaInjectable: z.boolean().default(false),
});

const updateConfigSchema = z.object({
  configValue: z.string().optional(),
  displayLabel: z.string().min(1).optional(),
  isFormulaInjectable: z.boolean().optional(),
});

export async function createConfig(c: Context) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const organizationId = session?.session?.activeOrganizationId;
  const userId = session?.user?.id;

  if (!organizationId || !userId) {
    return c.json({ error: "Missing organization ID or user ID" }, 401);
  }

  const body = await c.req.json();
  const parsed = createConfigSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid data", details: parsed.error.format() }, 400);
  }

  try {
    const [newConfig] = await db
      .insert(organizationConfigs)
      .values({
        id: uuidv4(),
        organizationId,
        configKey: parsed.data.configKey,
        configValue: parsed.data.configValue,
        displayLabel: parsed.data.displayLabel,
        valueType: parsed.data.valueType,
        isFormulaInjectable: parsed.data.isFormulaInjectable,
        updatedByUserId: userId,
      })
      .returning();

    return c.json(newConfig, 201);
  } catch (err: any) {
    if (err.code === '23505') { // Postgres unique violation
      return c.json({ error: "Config key must be unique per organization" }, 409);
    }
    console.error("Failed to create org config:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
}

export async function listConfigs(c: Context) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const organizationId = session?.session?.activeOrganizationId;

  if (!organizationId) {
    return c.json({ error: "Missing organization ID" }, 401);
  }

  const configs = await db
    .select()
    .from(organizationConfigs)
    .where(eq(organizationConfigs.organizationId, organizationId));

  return c.json(configs);
}

export async function updateConfig(c: Context) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const organizationId = session?.session?.activeOrganizationId;
  const userId = session?.user?.id;

  if (!organizationId || !userId) {
    return c.json({ error: "Missing organization ID or user ID" }, 401);
  }

  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing ID" }, 400);

  const body = await c.req.json();
  const parsed = updateConfigSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid data", details: parsed.error.format() }, 400);
  }

  const [updatedConfig] = await db
    .update(organizationConfigs)
    .set({
      ...(parsed.data.configValue !== undefined && { configValue: parsed.data.configValue }),
      ...(parsed.data.displayLabel !== undefined && { displayLabel: parsed.data.displayLabel }),
      ...(parsed.data.isFormulaInjectable !== undefined && { isFormulaInjectable: parsed.data.isFormulaInjectable }),
      updatedByUserId: userId,
    })
    .where(
      and(
        eq(organizationConfigs.id, id),
        eq(organizationConfigs.organizationId, organizationId)
      )
    )
    .returning();

  if (!updatedConfig) {
    return c.json({ error: "Config not found" }, 404);
  }

  return c.json(updatedConfig);
}

export async function deleteConfig(c: Context) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const organizationId = session?.session?.activeOrganizationId;

  if (!organizationId) {
    return c.json({ error: "Missing organization ID" }, 401);
  }

  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing ID" }, 400);

  // 1. Get the config to know its key
  const [config] = await db
    .select()
    .from(organizationConfigs)
    .where(
      and(
        eq(organizationConfigs.id, id),
        eq(organizationConfigs.organizationId, organizationId)
      )
    );

  if (!config) {
    return c.json({ error: "Config not found" }, 404);
  }

  const tokenToFind = `%ORG_${config.configKey}%`;

  // 2. Block if used in any template formula
  const rowsUsingConfig = await db
    .select({ id: templateRowComponents.id })
    .from(templateRowComponents)
    .innerJoin(templateRows, eq(templateRowComponents.rowId, templateRows.id))
    .innerJoin(invoiceTemplates, eq(invoiceTemplates.id, templateRows.templateId))
    .where(
      and(
        eq(invoiceTemplates.organizationId, organizationId),
        like(templateRowComponents.formula, tokenToFind)
      )
    )
    .limit(1);

  if (rowsUsingConfig.length > 0) {
    return c.json(
      { error: "Cannot delete config because it is used in one or more template formulas" },
      409
    );
  }

  // 3. Delete the config
  await db
    .delete(organizationConfigs)
    .where(
      and(
        eq(organizationConfigs.id, id),
        eq(organizationConfigs.organizationId, organizationId)
      )
    );

  return c.json({ success: true });
}
