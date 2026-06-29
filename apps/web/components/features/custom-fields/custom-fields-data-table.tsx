"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Lock, Shield, Edit } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/constants";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { AddCustomFieldModal } from "./add-custom-field-modal";

type CustomFieldDefinition = {
  id: string;
  entityType: "client" | "project" | "staff";
  fieldName: string;
  fieldKey: string;
  fieldType: string;
  isRequired: boolean;
  options: string[] | null;
  isSeeded: boolean;
  isSystem?: boolean;
};

export function CustomFieldsDataTable({ 
  fields, 
  isLoading,
  shownColumns,
  onToggleShow
}: { 
  fields: CustomFieldDefinition[], 
  isLoading: boolean,
  shownColumns?: string[],
  onToggleShow?: (id: string) => void
}) {
  const queryClient = useQueryClient();
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${apiUrl}/api/workspaces/custom-fields/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete field");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Custom field deleted");
      queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border rounded-md border-dashed bg-muted/10">
        <p className="text-sm text-muted-foreground">No custom fields defined yet.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Field Name</TableHead>
            <TableHead>Token</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Required</TableHead>
            <TableHead>Shown</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((field) => (
            <TableRow key={field.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {field.isSystem ? (
                    <Shield className="h-3 w-3 text-emerald-500" />
                  ) : field.isSeeded ? (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  ) : null}
                  {field.fieldName}
                </div>
              </TableCell>
              <TableCell>
                <span className="font-mono text-[11px] text-muted-foreground uppercase">{field.fieldKey}</span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {field.entityType}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="capitalize">
                  {field.fieldType.replace("_", " ")}
                </Badge>
              </TableCell>
              <TableCell>
                {field.isRequired ? (
                  <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-200">Required</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">Optional</Badge>
                )}
              </TableCell>
              <TableCell>
                {shownColumns && onToggleShow && (
                  <div className="flex items-center">
                    <input 
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      checked={shownColumns.includes(field.id)}
                      onChange={() => onToggleShow(field.id)}
                    />
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {!field.isSystem && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditingField(field)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {!field.isSystem && !field.isSeeded && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-600"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete the field "${field.fieldName}"?`)) {
                          deleteMutation.mutate(field.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {editingField && (
        <AddCustomFieldModal 
          isOpen={!!editingField} 
          onClose={() => setEditingField(null)}
          defaultEntity={editingField.entityType}
          editField={editingField}
        />
      )}
    </div>
  );
}
