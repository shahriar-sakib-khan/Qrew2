"use client";

/**
 * hooks/inventory/use-brands.ts
 * React Query hooks for brands CRUD.
 * Brands are fetched by product forms to populate the brand dropdown.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { brandsApi } from "@/lib/api/inventory";
import { toast } from "sonner";

export const BRANDS_KEY = ["inventory", "brands"] as const;

// Fetch all active brands for the org — used in product create/edit forms.
export function useBrands() {
  return useQuery({
    queryKey: BRANDS_KEY,
    queryFn: brandsApi.list,
  });
}

export function useCreateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: brandsApi.create,
    onSuccess: () => {
      toast.success("Brand created");
      qc.invalidateQueries({ queryKey: BRANDS_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => brandsApi.update(id, data),
    onSuccess: () => {
      toast.success("Brand updated");
      qc.invalidateQueries({ queryKey: BRANDS_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: brandsApi.remove,
    onSuccess: () => {
      toast.success("Brand deleted");
      // Also invalidate products since their brand relation may have been nullified.
      qc.invalidateQueries({ queryKey: BRANDS_KEY });
      qc.invalidateQueries({ queryKey: ["inventory", "products"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
