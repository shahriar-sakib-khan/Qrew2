"use client";

import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/constants";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AddEditInvoiceTemplateModal({ 
  isOpen, 
  onClose,
  editTemplate,
}: { 
  isOpen: boolean; 
  onClose: () => void;
  editTemplate?: any;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    documentType: "", // will hold the invoice type ID
  });

  // Pre-fill on open if editing
  useEffect(() => {
    if (isOpen) {
      if (editTemplate) {
        setFormData({
          name: editTemplate.name || "",
          description: editTemplate.description || "",
          documentType: editTemplate.documentType || "",
        });
      } else {
        setFormData({
          name: "",
          description: "",
          documentType: "",
        });
      }
    }
  }, [isOpen, editTemplate]);

  const { data: invoiceTypes } = useQuery({
    queryKey: ["invoice-types"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/invoice-types`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch invoice types");
      return res.json();
    },
  });

  // Set default type if not selected
  if (invoiceTypes?.length && !formData.documentType) {
    const defaultType = invoiceTypes.find((t: any) => t.isDefault) || invoiceTypes[0];
    if (defaultType) {
      setFormData(prev => ({ ...prev, documentType: defaultType.id }));
    }
  }

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editTemplate 
        ? `${apiUrl}/api/invoice-templates/${editTemplate.id}`
        : `${apiUrl}/api/invoice-templates`;

      const res = await fetch(url, {
        method: editTemplate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create template");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(editTemplate ? "Template updated" : "Template created");
      onClose();
      queryClient.invalidateQueries({ queryKey: ["invoice-templates"] });
      if (!editTemplate) {
        router.push(`/org-admin/invoice-templates/${data.id}`);
      }
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editTemplate ? "Edit Invoice Template" : "Create Invoice Template"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g. Standard Contractor Invoice"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g. Used for monthly freelance billing"
            />
          </div>

          <div className="space-y-2">
            <Label>Invoice Type</Label>
            <Select 
              value={formData.documentType} 
              onValueChange={(val) => setFormData({ ...formData, documentType: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {invoiceTypes?.map((type: any) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name} {type.isDefault ? "(Default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
