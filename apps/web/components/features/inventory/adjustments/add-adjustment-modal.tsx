"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProducts } from "@/hooks/inventory/use-products";
import { useWarehouses } from "@/hooks/inventory/use-warehouses";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryApi } from "@/lib/api/inventory";
import { toast } from "sonner";
import { SlidersHorizontal } from "lucide-react";

const adjustmentSchema = z.object({
  adjustmentType: z.enum(["ADJUSTMENT_IN", "ADJUSTMENT_OUT"]),
  productId: z.string().min(1, "Product is required"),
  stockState: z.enum(["NORMAL", "FULL", "EMPTY"]),
  quantity: z.string().min(1, "Quantity is required"),
  warehouseId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof adjustmentSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialProductId?: string;
}

export function AddAdjustmentModal({ isOpen, onClose, initialProductId }: Props) {
  const queryClient = useQueryClient();
  const { data: products } = useProducts();
  const { data: warehouses } = useWarehouses();

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(adjustmentSchema as any),
    defaultValues: {
      adjustmentType: "ADJUSTMENT_IN",
      productId: initialProductId ?? "",
      stockState: "NORMAL",
      quantity: "1",
      warehouseId: null,
      notes: "",
    },
  });

  const adjustmentType = watch("adjustmentType");

  useEffect(() => {
    if (!isOpen) return;
    reset({
      adjustmentType: "ADJUSTMENT_IN",
      productId: initialProductId ?? "",
      stockState: "NORMAL",
      quantity: "1",
      warehouseId: null,
      notes: "",
    });
  }, [isOpen, initialProductId, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const rawQty = Math.abs(parseFloat(values.quantity) || 0);
      const signedQty = values.adjustmentType === "ADJUSTMENT_OUT" ? (-rawQty).toString() : rawQty.toString();

      return inventoryApi.createTransaction({
        productId: values.productId,
        warehouseId: values.warehouseId,
        stockState: values.stockState,
        quantity: signedQty,
        transactionType: values.adjustmentType,
        referenceType: "MANUAL_ADJUSTMENT",
        notes: values.notes || `Stock Adjustment (${values.adjustmentType === "ADJUSTMENT_IN" ? "+IN" : "-OUT"})`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      toast.success(`Stock adjustment (${adjustmentType === "ADJUSTMENT_IN" ? "+IN" : "-OUT"}) recorded.`);
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to record adjustment.");
    },
  });

  function onSubmit(values: FormValues) {
    mutation.mutate(values);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px] bg-gray-50 border-gray-200 dark:bg-gray-900/40 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <SlidersHorizontal className="h-5 w-5 text-zinc-400" />
            Stock Adjustment
          </DialogTitle>
          <DialogDescription>
            Record manual inventory adjustments for stock count corrections or physical audit reconciliations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Adjustment Direction */}
          <div className="space-y-2">
            <Label>Adjustment Type *</Label>
            <Controller control={control} name="adjustmentType" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADJUSTMENT_IN">Stock IN (+) Add Correction</SelectItem>
                  <SelectItem value="ADJUSTMENT_OUT">Stock OUT (-) Deduct Correction / Loss</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </div>

          {/* Product */}
          <div className="space-y-2">
            <Label>Product *</Label>
            <Controller control={control} name="productId" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products?.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )} />
            {errors.productId && <p className="text-xs text-destructive">{errors.productId.message}</p>}
          </div>

          {/* Quantity & Warehouse */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Adjustment Quantity *</Label>
              <Controller control={control} name="quantity" render={({ field }) => (
                <Input
                  type="number"
                  step="0.001"
                  min="0.001"
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  placeholder="1"
                  {...field}
                />
              )} />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Warehouse</Label>
              <Controller control={control} name="warehouseId" render={({ field }) => (
                <Select value={field.value ?? "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {warehouses?.map((w: any) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Audit Reason / Adjustment Notes</Label>
            <Controller control={control} name="notes" render={({ field }) => (
              <Input placeholder="e.g. Physical inventory count discrepancy" {...field} value={field.value ?? ""} />
            )} />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Applying..." : "Record Adjustment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
