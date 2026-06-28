"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiUrl } from "@/lib/constants";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Zap } from "lucide-react";

export function AddEditSectionChargeModal({
  isOpen,
  onClose,
  templateId,
  sectionId,
  sectionToken,
  editCharge,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  sectionId: string;
  sectionToken: string;
  editCharge?: any;
  onSuccess?: () => void;
}) {
  const isEdit = !!editCharge;

  const [label, setLabel] = useState("");
  const [subDescription, setSubDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [formulaBase, setFormulaBase] = useState<"BASE" | "TOTAL" | "CHARGES">("BASE");
  const [formulaRest, setFormulaRest] = useState("");

  const previewFormula = `SEC_${sectionToken}_${formulaBase} ${formulaRest || ""}`;

  const AVAILABLE_TAGS = ["Discount", "Tax", "Surcharge", "Fee", "Port Dues"];

  useEffect(() => {
    if (!isOpen) return;
    if (editCharge) {
      setLabel(editCharge.label ?? "");
      setSubDescription(editCharge.subDescription ?? "");
      setTags(editCharge.tags ?? []);
      setFormulaBase(editCharge.formulaBase ?? "BASE");
      setFormulaRest(editCharge.formulaRest ?? "");
    } else {
      setLabel("");
      setSubDescription("");
      setTags([]);
      setFormulaBase("BASE");
      setFormulaRest("");
    }
  }, [isOpen, editCharge]);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = isEdit
        ? `${apiUrl}/api/invoice-templates/${templateId}/sections/${sectionId}/section-charges/${editCharge.id}`
        : `${apiUrl}/api/invoice-templates/${templateId}/sections/${sectionId}/section-charges`;

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save section charge");
      return data;
    },
    onSuccess: () => {
      toast.success(isEdit ? "Section charge updated" : "Section charge added");
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formulaRest.trim()) {
      toast.error("Formula rest is required (e.g. \" * 0.10\")");
      return;
    }
    mutation.mutate({
      label,
      subDescription: subDescription || null,
      tags: tags,
      qualifier: null, // Removed qualifier completely, sending null
      formulaBase,
      formulaRest,
    });
  };

  const BASE_OPTIONS = [
    { value: "BASE", label: `SEC_${sectionToken}_BASE`, desc: "Sum of all row bases" },
    { value: "TOTAL", label: `SEC_${sectionToken}_TOTAL`, desc: "Sum of rows + charges" },
    { value: "CHARGES", label: `SEC_${sectionToken}_CHARGES`, desc: "Sum of row charges only" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Section Charge" : "Add Section Charge"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Top Row: Label, Description, Tags */}
          <div className="grid grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="sc-label" className="text-xs">Charge label *</Label>
              <Input
                id="sc-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. PORT LEVY 10%"
                className="h-9 text-sm"
                required
                autoFocus
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="sc-desc" className="text-xs">Description</Label>
              <Input
                id="sc-desc"
                value={subDescription}
                onChange={(e) => setSubDescription(e.target.value)}
                placeholder="Optional explanation"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tags</Label>
              <Select
                value={tags[0] || "none"}
                onValueChange={(v) => setTags(v === "none" ? [] : [v])}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs text-muted-foreground">None</SelectItem>
                  {AVAILABLE_TAGS.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Formula section (Unified visual style) */}
          <div className="space-y-2">
            <Label className="text-xs text-amber-500 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Formula configuration *
            </Label>
            
            <div className="flex items-stretch gap-2">
              <div className="w-[280px] shrink-0">
                <Select
                  value={formulaBase}
                  onValueChange={(v) => setFormulaBase(v as any)}
                >
                  <SelectTrigger className="h-10 text-xs font-mono border-amber-500/30 bg-amber-500/5 focus:ring-amber-500/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BASE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs font-mono">
                        {opt.label}
                        <span className="ml-2 text-[10px] text-muted-foreground font-sans">
                          ({opt.desc})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Input
                value={formulaRest}
                onChange={(e) => setFormulaRest(e.target.value)}
                placeholder="e.g. * 0.10"
                className="h-10 text-sm font-mono border-amber-500/30 focus-visible:ring-amber-500/50 flex-1 bg-amber-500/5"
                required
              />
            </div>
            
            {/* Live formula preview */}
            <div className="mt-2 text-[11px] text-muted-foreground/80 flex items-center gap-2">
              <span>Evaluates as:</span>
              <code className="text-amber-500 font-mono px-1.5 py-0.5 bg-amber-500/10 rounded">
                {previewFormula}
              </code>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-amber-500 hover:bg-amber-600 text-white">
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Charge"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
