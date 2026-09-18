/**
 * inventory-enums.ts
 * All PostgreSQL enums for the inventory module.
 * Kept in one file so they can be imported by multiple schema files without circular deps.
 */

import { pgEnum } from "drizzle-orm/pg-core";

// Distinguishes between a simple stock-tracked product and a cylinder-style refillable product.
export const productTypeEnum = pgEnum("product_type", ["NORMAL", "REFILLABLE"]);

/**
 * Tracks which "state" of stock a ledger row refers to.
 * NORMAL  → used for non-refillable products.
 * FULL    → full cylinders (refillable, incoming or in-stock).
 * EMPTY   → empty cylinders (refillable, returned from customer).
 * This is NEVER nullable in inventory_transactions.
 */
export const stockStateEnum = pgEnum("stock_state", ["NORMAL", "FULL", "EMPTY"]);

// Purchase and Sale documents start as DRAFT, then move to CONFIRMED or CANCELLED.
// Ledger rows are only written on DRAFT → CONFIRMED transition.
export const documentStatusEnum = pgEnum("document_status", ["DRAFT", "CONFIRMED", "CANCELLED"]);

/**
 * Full forward-compatible enum for transaction types.
 * Only PURCHASE, SALE, PURCHASE_RETURN, SALE_RETURN, REFILL_IN are implemented in v1.
 * The rest are here so we don't need a schema migration later.
 */
export const inventoryTransactionTypeEnum = pgEnum("inventory_transaction_type", [
  "OPENING_STOCK",
  "PURCHASE",
  "SALE",
  "PURCHASE_RETURN",
  "SALE_RETURN",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "DAMAGE",
  "REFILL_OUT",
  "REFILL_IN",
]);

// Tells us which document table the referenceId points to.
export const inventoryReferenceTypeEnum = pgEnum("inventory_reference_type", [
  "PURCHASE",
  "SALE",
  "MANUAL_ADJUSTMENT",
  "TRANSFER",
  "SALE_RETURN",
  "PURCHASE_RETURN",
]);

// Document types used by the auto-number counter table.
export const documentCounterTypeEnum = pgEnum("document_counter_type", [
  "PURCHASE",
  "SALE",
  "SALE_RETURN",
  "PURCHASE_RETURN",
]);
