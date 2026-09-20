/**
 * hooks/inventory/use-customers.ts
 * React Query hooks for inventory customer CRUD.
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { customersApi } from "@/lib/api/inventory";

export const CUSTOMERS_KEY = ["inventory", "customers"] as const;

export function useInventoryCustomers() {
  return useQuery({
    queryKey: CUSTOMERS_KEY,
    queryFn: customersApi.list,
  });
}

export function useCreateInventoryCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: customersApi.create,
    onSuccess: () => {
      toast.success("Customer created");
      qc.invalidateQueries({ queryKey: CUSTOMERS_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateInventoryCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => customersApi.update(id, data),
    onSuccess: () => {
      toast.success("Customer updated");
      qc.invalidateQueries({ queryKey: CUSTOMERS_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteInventoryCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: customersApi.remove,
    onSuccess: () => {
      toast.success("Customer deleted");
      qc.invalidateQueries({ queryKey: CUSTOMERS_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
