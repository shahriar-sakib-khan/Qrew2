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
  isDetailed?: boolean;
  isSensitive?: boolean;
};

export function CustomFieldsDataTable({ 
  fields, 
  isLoading,
  detailedFields,
  sensitiveFields,
  onToggleDetailed,
  onToggleSensitive
}: { 
  fields: CustomFieldDefinition[], 
  isLoading: boolean,
  detailedFields?: string[],
  sensitiveFields?: string[],
  onToggleDetailed?: (id: string, isSystem: boolean) => void,
  onToggleSensitive?: (id: string, isSystem: boolean) => void
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
            <TableHead className="text-[15px]">Field Name</TableHead>
            <TableHead className="text-[15px]">Entity</TableHead>
            <TableHead className="text-[15px]">Type</TableHead>
            <TableHead className="text-[15px]">Required</TableHead>
            <TableHead className="text-[15px]">Detailed</TableHead>
            <TableHead className="text-[15px]">Sensitive</TableHead>
            <TableHead className="text-[15px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((field) => {
            const isDetailed = field.isSystem && detailedFields ? detailedFields.includes(field.id) : !!field.isDetailed;
            const isSensitive = field.isSystem && sensitiveFields ? sensitiveFields.includes(field.id) : !!field.isSensitive;

            return (
              <TableRow key={field.id}>
                <TableCell className="font-medium text-[15px]">
                  <div className="flex items-center gap-2">
                    {field.isSystem ? (
                      <Shield className="h-4 w-4 text-emerald-500" />
                    ) : field.isSeeded ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : null}
                    <span>{field.fieldName}</span>
                    <Badge variant="secondary" className="font-mono text-[10px] uppercase ml-1 px-1.5 py-0 h-5 items-center justify-center">
                      {field.fieldKey}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize text-sm">
                    {field.entityType}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize text-sm">
                    {field.fieldType.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  {field.isRequired ? (
                    <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-200 text-sm">Required</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-sm">Optional</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {onToggleDetailed && (
                    <div className="flex items-center">
                      <input 
                        type="checkbox"
                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        checked={isDetailed}
                        onChange={() => onToggleDetailed(field.id, !!field.isSystem)}
                      />
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {onToggleSensitive && (
                    <div className="flex items-center">
                      <input 
                        type="checkbox"
                        className="w-5 h-5 rounded border-gray-300 text-red-500 focus:ring-red-500 cursor-pointer"
                        checked={isSensitive}
                        onChange={() => onToggleSensitive(field.id, !!field.isSystem)}
                      />
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {!field.isSystem && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingField(field)}
                      >
                        <Edit className="h-5 w-5" />
                      </Button>
                    )}
                    {!field.isSystem && !field.isSeeded && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-red-600"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete the field "${field.fieldName}"?`)) {
                            deleteMutation.mutate(field.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
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
