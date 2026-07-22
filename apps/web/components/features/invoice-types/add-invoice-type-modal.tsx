"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { apiUrl } from "@/lib/constants";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AddInvoiceTypeModal({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const { mutate: addType, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${apiUrl}/api/invoice-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, isDefault: false }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add invoice type");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Invoice type added");
      queryClient.invalidateQueries({ queryKey: ["invoice-types"] });
      setName("");
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Invoice Type</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Type Name</Label>
            <Input
              id="name"
              placeholder="e.g. Proforma, PDA"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => addType()} disabled={!name || isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Add Type
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
