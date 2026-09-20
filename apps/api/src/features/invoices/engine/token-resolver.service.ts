import { eq, and, sql } from "drizzle-orm";
import type { ResolvedScopeV2 } from "@starter/db";
import {
  organizationConfigs,
  expenses,
  expenseCategories,
  templateHeaderFields,
  templateConstants,
  projects,
  projectStatuses,
} from "@starter/db";
import * as math from "mathjs";

const bigMath = math.create(math.all, { number: "BigNumber", precision: 20 });

export interface ResolveScopeInput {
  projectId: string;
  organizationId: string;
  templateId: string;
  /** Any TX-aware drizzle instance (db or tx inside a transaction) */
  db: any;
  /** Manual header field overrides from the invoice draft/generator */
  headerFieldValues?: Record<string, string>;
}

/**
 * Resolves the full token scope for a given project + template combination.
 *
 * Returns Record<tokenKey, BigNumber-as-string> — never undefined for known tokens.
 *
 * 1. EXP_* / CAT_* — SUM of expenses per category
 * 2. GBL_* / ORG_* — organization_configs WHERE isFormulaInjectable = true
 * 3. TPL_* — template_constants for the given template
 * 4. FILE_* — from projects.customFields + direct columns per template_header_fields config
 *
 * All values stored as serialized BigNumber strings (e.g. "4200.000000")
 */
export async function resolveScope(input: ResolveScopeInput): Promise<Record<string, string>> {
  const { projectId, organizationId, templateId, db, headerFieldValues = {} } = input;
  const scope: Record<string, string> = {};

  // -----------------------------------------------------------------------
  // 1. EXP_* / CAT_* — expense category sums for this project
  // -----------------------------------------------------------------------

  // First, get ALL categories for the org (so we can zero-initialize them)
  const allCategories = await db
    .select({
      tokenKey: expenseCategories.tokenKey,
    })
    .from(expenseCategories)
    .where(eq(expenseCategories.organizationId, organizationId));

  for (const cat of allCategories) {
    if (cat.tokenKey) {
      scope[`EXP_${cat.tokenKey}`] = "0.000000";
      scope[`CAT_${cat.tokenKey}`] = "0.000000";
    }
  }

  // Then, compute actual sums and override the zeros
  const categorySums = await db
    .select({
      tokenKey: expenseCategories.tokenKey,
      total: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)::text`,
    })
    .from(expenseCategories)
    .leftJoin(
      expenses,
      and(
        eq(expenses.categoryId, expenseCategories.id),
        eq(expenses.projectId, projectId),
        eq(expenses.organizationId, organizationId)
      )
    )
    .where(eq(expenseCategories.organizationId, organizationId))
    .groupBy(expenseCategories.tokenKey, expenseCategories.id);

  for (const row of categorySums) {
    if (row.tokenKey) {
      const bn = bigMath.bignumber(row.total ?? "0");
      const formatted = (bn as math.BigNumber).toFixed(6);
      scope[`EXP_${row.tokenKey}`] = formatted;
      scope[`CAT_${row.tokenKey}`] = formatted;
    }
  }

  // -----------------------------------------------------------------------
  // 2. GBL_* / ORG_* — injectable organization constants
  // -----------------------------------------------------------------------
  const orgConfigs = await db
    .select()
    .from(organizationConfigs)
    .where(
      and(
        eq(organizationConfigs.organizationId, organizationId),
        eq(organizationConfigs.isFormulaInjectable, true)
      )
    );

  for (const conf of orgConfigs) {
    const bn = bigMath.bignumber(conf.configValue ?? "0");
    const formatted = (bn as math.BigNumber).toFixed(6);
    scope[`GBL_${conf.configKey}`] = formatted;
    scope[`ORG_${conf.configKey}`] = formatted;
  }

  // -----------------------------------------------------------------------
  // 3. TPL_* — template constants
  // -----------------------------------------------------------------------
  const tplConsts = await db
    .select()
    .from(templateConstants)
    .where(eq(templateConstants.templateId, templateId));

  for (const c of tplConsts) {
    const val = parseFloat(c.defaultValue ?? "0");
    const bn = bigMath.bignumber(isNaN(val) ? 0 : val);
    const formatted = (bn as math.BigNumber).toFixed(6);
    scope[c.token] = formatted;
    scope[`TPL_${c.token}`] = formatted;
  }

  // -----------------------------------------------------------------------
  // 4. FILE_* — project fields per template header field configuration
  // -----------------------------------------------------------------------

  // Fetch the project row (for customFields + direct columns)
  const [projectData] = await db
    .select({
      project: projects,
      statusName: projectStatuses.name,
    })
    .from(projects)
    .leftJoin(projectStatuses, eq(projects.status, projectStatuses.id))
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
    .limit(1);

  const project = projectData?.project;
  const statusName = projectData?.statusName;

  // Fetch injectable header fields for this template
  const headerFields = await db
    .select()
    .from(templateHeaderFields)
    .where(
      and(
        eq(templateHeaderFields.templateId, templateId),
        eq(templateHeaderFields.isFormulaInjectable, true)
      )
    );

  for (const field of headerFields) {
    if (!field.fileFieldKey) continue;

    const tokenKey = `FILE_${field.fileFieldKey.toUpperCase()}`;

    // Check if staff provided a manual override for this field
    if (headerFieldValues[field.id] !== undefined) {
      const bn = bigMath.bignumber(headerFieldValues[field.id] || "0");
      scope[tokenKey] = (bn as math.BigNumber).toFixed(6);
      continue;
    }

    // Try to read from project data
    if (project) {
      let rawValue: string | number | null = null;

      if (field.fileFieldKey === "status") {
        rawValue = statusName ?? project.status;
      } else if (field.fileFieldKey in (project as any)) {
        rawValue = (project as any)[field.fileFieldKey];
      } else if (project.customFields && field.fileFieldKey in project.customFields) {
        rawValue = project.customFields[field.fileFieldKey];
      }

      if (rawValue !== null && rawValue !== undefined) {
        const parsed = parseFloat(String(rawValue));
        if (!isNaN(parsed)) {
          const bn = bigMath.bignumber(parsed);
          scope[tokenKey] = (bn as math.BigNumber).toFixed(6);
          continue;
        }
      }
    }

    // Use field default or 0
    const defaultVal = field.defaultManualValue ?? "0";
    const parsed = parseFloat(defaultVal);
    const bn = bigMath.bignumber(isNaN(parsed) ? 0 : parsed);
    scope[tokenKey] = (bn as math.BigNumber).toFixed(6);
  }

  // Inject all project custom fields under FILE_<KEY> prefix (no phantom bare aliases)
  if (project && project.customFields) {
    for (const [key, value] of Object.entries(project.customFields)) {
      if (value !== null && value !== undefined) {
        const parsed = parseFloat(String(value));
        if (!isNaN(parsed)) {
          const bn = bigMath.bignumber(parsed);
          scope[`FILE_${key.toUpperCase()}`] = (bn as math.BigNumber).toFixed(6);
        }
      }
    }
  }

  return scope;
}

/**
 * Resolves the scope and wraps it in a ResolvedScopeV2 object for storage
 * in invoices.resolved_scope.
 */
export async function resolveScopeWithMeta(
  input: ResolveScopeInput
): Promise<{ scope: Record<string, string>; meta: ResolvedScopeV2 }> {
  const scope = await resolveScope(input);
  const meta: ResolvedScopeV2 = {
    schemaVersion: "2.0",
    resolvedAt: new Date().toISOString(),
    projectId: input.projectId,
    tokens: scope,
  };
  return { scope, meta };
}


