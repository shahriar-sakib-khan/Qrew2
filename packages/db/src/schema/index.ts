/**
 * Central schema export.
 *
 * Every schema file in this folder is re-exported from here.
 * - drizzle-kit reads this to discover all tables for migrations
/**
 * Central schema export.
 *
 * Every schema file in this folder is re-exported from here.
 * - drizzle-kit reads this to discover all tables for migrations
 * - Application code imports tables and types from '@starter/db'
 *   which resolves through src/index.ts → src/schema/index.ts
 *
 * When adding a new schema file (e.g. org.ts in Phase 2),
 * add a single line here: export * from './org'
 */
export * from "./auth";
export * from "./pbac";
export * from "./clients";
export * from "./projects";
export * from "./custom_fields";
export * from "./expense_categories";
export * from "./requisitions";
export * from "./expenses";
export * from "./wallet_transactions";
export * from "./invoices";
export * from "./invoice-enums";
export * from "./invoice-configs";
export * from "./invoice-templates";
export * from "./invoice-instances";
export * from "./invoice-types";
export * from "./project_attachments";
export * from "./project-statuses";
