/**
 * hooks/inventory/use-sales.ts
 * React Query hooks for sales CRUD + status transitions.
 * confirm/cancel invalidate both sales AND stock queries.
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { salesApi } from "@/lib/api/inventory";
import { toast } from "sonner";

export const SALES_KEY = ["inventory", "sales"] as const;
export const STOCK_KEY = ["inventory", "stock"] as const;

export function useSales(status?: string) {
  return useQuery({
    queryKey: [...SALES_KEY, status],
    queryFn: () => salesApi.list(status),
  });
}

export function useSale(id: string) {
  return useQuery({
    queryKey: [...SALES_KEY, id],
    queryFn: () => salesApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: salesApi.create,
    onSuccess: () => {
      toast.success("Sale draft created");
      qc.invalidateQueries({ queryKey: SALES_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => salesApi.update(id, data),
    onSuccess: () => {
      toast.success("Sale updated");
      qc.invalidateQueries({ queryKey: SALES_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: salesApi.remove,
    onSuccess: () => {
      toast.success("Sale deleted");
      qc.invalidateQueries({ queryKey: SALES_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Confirms a DRAFT sale — stock check + ledger write happens on the server.
export function useConfirmSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: salesApi.confirm,
    onSuccess: () => {
      toast.success("Sale confirmed — stock deducted");
      qc.invalidateQueries({ queryKey: SALES_KEY });
      qc.invalidateQueries({ queryKey: STOCK_KEY });
    },
    // Server returns a 409 with a descriptive message on insufficient stock.
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCancelSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: salesApi.cancel,
    onSuccess: () => {
      toast.success("Sale cancelled — stock restored");
      qc.invalidateQueries({ queryKey: SALES_KEY });
      qc.invalidateQueries({ queryKey: STOCK_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
