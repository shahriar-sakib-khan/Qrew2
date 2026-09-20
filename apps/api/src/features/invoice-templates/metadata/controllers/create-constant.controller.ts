import { Context } from "hono";
import { db, templateConstants } from "@starter/db";
import { z } from "zod";

const createConstantSchema = z.object({
  key: z.string().min(1).regex(/^[A-Z0-9_]+$/),
  valueType: z.enum(["number", "percentage", "currency_rate", "text"]),
  value: z.string().optional().default(""),
  description: z.string().optional(),
});

export async function createConstant(c: Context) {
  const templateId = c.req.param("templateId") as string;
  
  const body = await c.req.json();
  const parsed = createConstantSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error }, 400);

  const [newConstant] = await db
    .insert(templateConstants)
    .values({
      id: crypto.randomUUID(),
      templateId,
      token: parsed.data.key,
      valueType: parsed.data.valueType,
      defaultValue: parsed.data.value,
      name: parsed.data.description || parsed.data.key,
    })
    .returning();

  return c.json(newConstant, 201);
}
