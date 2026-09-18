/**
 * org-document-counters.ts
 * Tracks the last-used sequential number per document type per organization.
 * Used to auto-generate human-readable document numbers like PUR-001, SAL-001.
 *
 * WHY a dedicated table:
 * Using MAX()+1 on the purchases/sales table is a race condition — two concurrent
 * requests could read the same MAX and produce duplicate numbers.
 * This table is updated with SELECT ... FOR UPDATE inside the same transaction
 * that creates the document, making it concurrency-safe.
 */

import { pgTable, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { organizations } from "./auth";
import { documentCounterTypeEnum } from "./inventory-enums";

export const orgDocumentCounters = pgTable("org_document_counters", {
  id: text("id").primaryKey(),

  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),

  // Which document type this counter tracks (PURCHASE or SALE).
  documentType: documentCounterTypeEnum("document_type").notNull(),

  // The last number that was used. Next number = lastNumber + 1.
  lastNumber: integer("last_number").default(0).notNull(),

  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}, (table) => [
  // Each org has exactly one counter row per document type.
  unique("org_doc_counter_unique").on(table.organizationId, table.documentType),
]);

export type OrgDocumentCounter = typeof orgDocumentCounters.$inferSelect;
export type NewOrgDocumentCounter = typeof orgDocumentCounters.$inferInsert;
