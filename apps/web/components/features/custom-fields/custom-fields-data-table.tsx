"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Lock, Shield } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/constants";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

type CustomFieldDefinition = {
  id: string;
  entityType: "client" | "project";
  fieldName: string;
  fieldKey: string;
  fieldType: string;
  isRequired: boolean;
  options: string[] | null;
  isSeeded: boolean;
  isSystem?: boolean;
};

export function CustomFieldsDataTable({ fields, isLoading }: { fields: CustomFieldDefinition[], isLoading: boolean }) {
  const queryClient = useQueryClient();

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
            <TableHead>Entity</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Required</TableHead>
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
                  {field.isSystem && (
                    <Badge variant="outline" className="ml-2 text-[10px] h-5 bg-muted">System</Badge>
                  )}
                </div>
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
                  <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-none">Yes</Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">No</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {!field.isSystem && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete ${field.fieldName}?`)) {
                        deleteMutation.mutate(field.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
