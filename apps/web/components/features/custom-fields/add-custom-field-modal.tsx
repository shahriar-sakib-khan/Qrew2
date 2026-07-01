"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiUrl } from "@/lib/constants";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { X } from "lucide-react";

type FieldType = "text" | "number" | "date" | "boolean" | "single_select" | "multi_select";

export function AddCustomFieldModal({ 
  isOpen, 
  onClose, 
  defaultEntity = "client",
  editField
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  defaultEntity?: "client" | "project" | "staff";
  editField?: any;
}) {
  const queryClient = useQueryClient();
  
  const [entityType, setEntityType] = useState<"client" | "project" | "staff">(defaultEntity);
  const [fieldName, setFieldName] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [isRequired, setIsRequired] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState("");

  const isEditMode = !!editField;

  // Sync default entity when modal opens
  useEffect(() => {
    if (isOpen) {
      if (editField) {
        setEntityType(editField.entityType);
        setFieldName(editField.fieldName);
        setFieldKey(editField.fieldKey);
        setFieldType(editField.fieldType as FieldType);
        setIsRequired(editField.isRequired);
        setOptions(editField.options || []);
      } else {
        setEntityType(defaultEntity);
        setFieldName("");
        setFieldKey("");
        setFieldType("text");
        setIsRequired(false);
        setOptions([]);
      }
      setNewOption("");
    }
  }, [isOpen, defaultEntity, editField]);

  // Auto-generate key from name only in add mode
  useEffect(() => {
    if (fieldName && !isEditMode) {
      setFieldKey(fieldName.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, ""));
    }
  }, [fieldName, isEditMode]);

  const addOption = () => {
    if (newOption.trim() && !options.includes(newOption.trim())) {
      setOptions([...options, newOption.trim()]);
      setNewOption("");
    }
  };

  const removeOption = (opt: string) => {
    setOptions(options.filter((o) => o !== opt));
  };

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const url = isEditMode 
        ? `${apiUrl}/api/workspaces/custom-fields/${editField.id}` 
        : `${apiUrl}/api/workspaces/custom-fields`;
      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to ${isEditMode ? 'update' : 'create'} field`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(`Custom field ${isEditMode ? 'updated' : 'created'} successfully`);
      queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldName || !fieldKey) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    mutation.mutate({
      entityType,
      fieldName,
      fieldKey,
      fieldType,
      isRequired,
      options: ["single_select", "multi_select"].includes(fieldType) ? options : null,
    });
  };

  const isSelectType = fieldType === "single_select" || fieldType === "multi_select";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit" : "Add"} Custom Field ({defaultEntity === "client" ? "Client" : defaultEntity === "project" ? "Project" : "Staff"})</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Update an existing custom field." : `Create a new custom field to attach data to ${defaultEntity}s.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6 mt-2">
          
          <div className="space-y-2">
            <Label>Field Name</Label>
            <Input 
              placeholder="e.g. Tax ID, Start Date, Budget" 
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              required
            />
          </div>

          {/* Token is auto-generated and hidden from the user */}

          <div className="space-y-2">
            <Label>Field Type</Label>
            <Select value={fieldType} onValueChange={(val: any) => setFieldType(val)} disabled={isEditMode}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="boolean">Boolean (Checkbox)</SelectItem>
                <SelectItem value="single_select">Single Select (Dropdown)</SelectItem>
                <SelectItem value="multi_select">Multi Select (Dropdown)</SelectItem>
                <SelectItem value="others">Others</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isSelectType && (
            <div className="space-y-3 p-4 border rounded-md bg-muted/20">
              <Label>Dropdown Options</Label>
              <div className="flex gap-2">
                <Input 
                  value={newOption} 
                  onChange={(e) => setNewOption(e.target.value)}
                  placeholder="Type option and press Add"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                />
                <Button type="button" variant="secondary" onClick={addOption}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {options.map((opt) => (
                  <div key={opt} className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm">
                    {opt}
                    <button type="button" onClick={() => removeOption(opt)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              {options.length === 0 && <p className="text-xs text-muted-foreground">No options added yet. At least one is required.</p>}
            </div>
          )}

          <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
            <Checkbox 
              id="isRequired" 
              checked={isRequired} 
              onCheckedChange={(c) => setIsRequired(c === true)} 
            />
            <div className="space-y-1 leading-none">
              <Label htmlFor="isRequired" className="cursor-pointer">
                Required Field
              </Label>
              <p className="text-[0.8rem] text-muted-foreground">
                Users must fill this out when creating or editing a {defaultEntity}.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button 
              type="submit" 
              disabled={mutation.isPending || (isSelectType && options.length === 0)}
            >
              {mutation.isPending ? (isEditMode ? "Saving..." : "Creating...") : (isEditMode ? "Save Changes" : "Create Field")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
