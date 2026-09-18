/**
 * hooks/inventory/use-stock.ts
 * React Query hooks for read-only stock and transaction ledger queries.
 *
 * Stock is always fetched live from the API (which aggregates from the ledger).
 * staleTime is set to 30s — short enough to feel current, long enough to avoid
 * hammering the DB on every render while navigating the inventory pages.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api/inventory";

export const STOCK_KEY = ["inventory", "stock"] as const;
export const TRANSACTIONS_KEY = ["inventory", "transactions"] as const;

// Returns current stock levels for all products (or a specific product if productId is given).
export function useStock(productId?: string) {
  return useQuery({
    queryKey: [...STOCK_KEY, productId],
    queryFn: () => inventoryApi.getStock(productId),
    staleTime: 30_000, // 30 seconds
  });
}

// Paginated transaction history (the ledger audit view).
export function useInventoryTransactions(params?: {
  productId?: string;
  warehouseId?: string;
  transactionType?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: [...TRANSACTIONS_KEY, params],
    queryFn: () => inventoryApi.getTransactions(params),
    staleTime: 30_000,
  });
}
