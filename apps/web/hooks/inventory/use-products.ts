/**
 * hooks/inventory/use-products.ts
 * React Query hooks for product CRUD.
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { productsApi } from "@/lib/api/inventory";

export const PRODUCTS_KEY = ["inventory", "products"] as const;

export function useProducts(params?: { type?: string; categoryId?: string; isActive?: boolean }) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, params],
    queryFn: () => productsApi.list(params),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, id],
    queryFn: () => productsApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => {
      toast.success("Product created");
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productsApi.update(id, data),
    onSuccess: () => {
      toast.success("Product updated");
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: productsApi.remove,
    onSuccess: () => {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
