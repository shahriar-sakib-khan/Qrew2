"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/constants";
import { useState, useEffect } from "react";
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
// Removed Checkbox
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function processTokenInput(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/ /g, "_")
    .replace(/[^A-Z0-9_]/g, "")
    .replace(/^_+/, "")
    .replace(/_+/g, "_");
}

export function AddEditOrgConfigModal({ 
  isOpen, 
  onClose, 
  editConfig 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  editConfig?: any 
}) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    configKey: "",
    configValue: "",
    valueType: "number",
  });

  useEffect(() => {
    if (editConfig) {
      setFormData({
        configKey: editConfig.configKey,
        configValue: editConfig.configValue,
        valueType: editConfig.valueType,
      });
    } else {
      setFormData({
        configKey: "",
        configValue: "",
        valueType: "number",
      });
    }
  }, [editConfig, isOpen]);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editConfig 
        ? `${apiUrl}/api/org-configs/${editConfig.id}`
        : `${apiUrl}/api/org-configs`;
      
      const res = await fetch(url, {
        method: editConfig ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save config");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(editConfig ? "Config updated" : "Config created");
      onClose();
      queryClient.invalidateQueries({ queryKey: ["org-configs"] });
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let token = formData.configKey;
    // If user left a trailing underscore, strip it on submit
    token = token.replace(/_+$/, "");
    if (!token) {
      toast.error("Token is required");
      return;
    }
    
    mutation.mutate({
      ...formData,
      configKey: editConfig ? undefined : token,
      displayLabel: token,
      isFormulaInjectable: true,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editConfig ? "Edit Configuration" : "Add Configuration"}</DialogTitle>
          <div className="flex gap-2 items-start bg-amber-500/10 text-amber-500 p-3 rounded-md text-sm mt-4">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              <strong>Global Constant:</strong> Changes made here will affect <em>all</em> invoice templates across the organization.
            </p>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="configKey">Token</Label>
            <div className="flex items-center">
              <span className="text-muted-foreground font-mono bg-muted px-3 py-2 text-sm border border-r-0 rounded-l-md select-none border-input">
                ORG_
              </span>
              <Input
                id="configKey"
                value={formData.configKey}
                onChange={(e) => {
                  setFormData({ 
                    ...formData, 
                    configKey: processTokenInput(e.target.value) 
                  });
                }}
                required
                placeholder="VAT_RATE"
                className="font-mono rounded-l-none focus-visible:z-10"
                disabled={!!editConfig}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valueType">Value Type</Label>
              <Select
                value={formData.valueType}
                onValueChange={(val) => setFormData({ ...formData, valueType: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="configValue">Value (Optional)</Label>
              <Input
                id="configValue"
                value={formData.configValue}
                onChange={(e) => setFormData({ ...formData, configValue: e.target.value })}
                placeholder={formData.valueType === "number" ? "e.g. 0.15" : "e.g. standard"}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editConfig ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
