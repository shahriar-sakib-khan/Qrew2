"use client";

/**
 * add-customer-modal.tsx
 * Create/Edit modal for inventory customers (buyers).
 */

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCreateInventoryCustomer, useUpdateInventoryCustomer } from "@/hooks/inventory/use-customers";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
});
type FormValues = z.infer<typeof schema>;

interface Props { isOpen: boolean; onClose: () => void; editCustomer?: any; }

export function AddCustomerModal({ isOpen, onClose, editCustomer }: Props) {
  const createCustomer = useCreateInventoryCustomer();
  const updateCustomer = useUpdateInventoryCustomer();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema as any),
    defaultValues: { name: "", phone: null, email: null, address: null },
  });

  useEffect(() => {
    if (!isOpen) return;
    reset(editCustomer
      ? { name: editCustomer.name, phone: editCustomer.phone, email: editCustomer.email || "", address: editCustomer.address }
      : { name: "", phone: null, email: null, address: null });
  }, [isOpen, editCustomer, reset]);

  function onSubmit(values: FormValues) {
    const payload = { ...values, email: values.email || null };
    if (editCustomer) {
      updateCustomer.mutate({ id: editCustomer.id, data: payload }, { onSuccess: onClose });
    } else {
      createCustomer.mutate(payload, { onSuccess: onClose });
    }
  }

  const isPending = createCustomer.isPending || updateCustomer.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{editCustomer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
          <DialogDescription>Customer details for sales records.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Controller control={control} name="name" render={({ field }) => <Input placeholder="Customer name" {...field} />} />
            {errors.name && <p className="text-[0.8rem] text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Controller control={control} name="phone" render={({ field }) => <Input placeholder="+880..." {...field} value={field.value ?? ""} />} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Controller control={control} name="email" render={({ field }) => <Input type="email" placeholder="Optional" {...field} value={field.value ?? ""} />} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Controller control={control} name="address" render={({ field }) => <Input placeholder="Optional" {...field} value={field.value ?? ""} />} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : (editCustomer ? "Save Changes" : "Add Customer")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

