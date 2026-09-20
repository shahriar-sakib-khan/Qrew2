"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiUrl } from "@/lib/constants";
import { toast } from "sonner";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface AddHeaderFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  onSuccess: () => void;
}

export function AddHeaderFieldModal({ isOpen, onClose, templateId, onSuccess }: AddHeaderFieldModalProps) {
  const [label, setLabel] = useState("");
  const [dataType, setDataType] = useState("text");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;

    setIsSubmitting(true);
    try {
      // Auto-generate a fieldKey from label by slugifying and uppercasing it, e.g. "My Field" -> "MY_FIELD"
      const fileFieldKey = label.trim().replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();

      const res = await fetch(`${apiUrl}/api/invoice-templates/${templateId}/header-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          label: label.trim(),
          fieldType: "file_field", // Default to file_field so draft engine expects it in project.customFields or defaults to 0
          fileFieldKey,
          isFormulaInjectable: dataType === "number",
        }),
      });

      if (!res.ok) throw new Error("Failed to create header field");
      
      toast.success("Header field added to template");
      onSuccess();
      onClose();
      setLabel("");
    } catch (error) {
      console.error(error);
      toast.error("An error occurred while adding the header field");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add File Description Field</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="label">Field Label</Label>
            <Input
              id="label"
              placeholder="e.g. Tax ID, GRT, Reference Number"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Data Type</Label>
            <Select value={dataType} onValueChange={setDataType}>
              <SelectTrigger>
                <SelectValue placeholder="Select data type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text (Not used in formulas)</SelectItem>
                <SelectItem value="number">Number (Can be used in formulas)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !label.trim()}>
              {isSubmitting ? "Adding..." : "Add Field"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
