/**
 * hooks/inventory/use-product-categories.ts
 * React Query hooks for product category CRUD.
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productCategoriesApi } from "@/lib/api/inventory";
import { toast } from "sonner";

export const CATEGORIES_KEY = ["inventory", "product-categories"] as const;

// Fetches all categories for the org — used in product forms and category management.
export function useProductCategories() {
  return useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: productCategoriesApi.list,
  });
}

export function useCreateProductCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: productCategoriesApi.create,
    onSuccess: () => {
      toast.success("Category created");
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateProductCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productCategoriesApi.update(id, data),
    onSuccess: () => {
      toast.success("Category updated");
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteProductCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: productCategoriesApi.remove,
    onSuccess: () => {
      toast.success("Category deleted");
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
