/**
 * hooks/inventory/use-purchases.ts
 * React Query hooks for purchases CRUD + status transitions.
 *
 * After confirm/cancel, we invalidate both the purchases list AND the stock query
 * because confirming a purchase changes the live stock levels.
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { purchasesApi } from "@/lib/api/inventory";

export const PURCHASES_KEY = ["inventory", "purchases"] as const;
export const STOCK_KEY = ["inventory", "stock"] as const;

export function usePurchases(status?: string) {
  return useQuery({
    queryKey: [...PURCHASES_KEY, status],
    queryFn: () => purchasesApi.list(status),
  });
}

export function usePurchase(id: string) {
  return useQuery({
    queryKey: [...PURCHASES_KEY, id],
    queryFn: () => purchasesApi.getById(id),
    enabled: !!id,
  });
}

export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: purchasesApi.create,
    onSuccess: () => {
      toast.success("Purchase draft created");
      qc.invalidateQueries({ queryKey: PURCHASES_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => purchasesApi.update(id, data),
    onSuccess: () => {
      toast.success("Purchase updated");
      qc.invalidateQueries({ queryKey: PURCHASES_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeletePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: purchasesApi.remove,
    onSuccess: () => {
      toast.success("Purchase deleted");
      qc.invalidateQueries({ queryKey: PURCHASES_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Confirms a DRAFT purchase — writes stock-IN rows to the ledger.
// Invalidates stock queries so any stock display refreshes immediately.
export function useConfirmPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: purchasesApi.confirm,
    onSuccess: () => {
      toast.success("Purchase confirmed — stock updated");
      qc.invalidateQueries({ queryKey: PURCHASES_KEY });
      qc.invalidateQueries({ queryKey: STOCK_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Cancels a CONFIRMED purchase — writes reversal rows.
export function useCancelPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: purchasesApi.cancel,
    onSuccess: () => {
      toast.success("Purchase cancelled");
      qc.invalidateQueries({ queryKey: PURCHASES_KEY });
      qc.invalidateQueries({ queryKey: STOCK_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
