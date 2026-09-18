/**
 * hooks/inventory/use-warehouses.ts
 * React Query hooks for warehouse CRUD.
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { warehousesApi } from "@/lib/api/inventory";
import { toast } from "sonner";

export const WAREHOUSES_KEY = ["inventory", "warehouses"] as const;

export function useWarehouses() {
  return useQuery({
    queryKey: WAREHOUSES_KEY,
    queryFn: warehousesApi.list,
  });
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: warehousesApi.create,
    onSuccess: () => {
      toast.success("Warehouse created");
      qc.invalidateQueries({ queryKey: WAREHOUSES_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => warehousesApi.update(id, data),
    onSuccess: () => {
      toast.success("Warehouse updated");
      qc.invalidateQueries({ queryKey: WAREHOUSES_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: warehousesApi.remove,
    onSuccess: () => {
      toast.success("Warehouse deleted");
      qc.invalidateQueries({ queryKey: WAREHOUSES_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
