"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Edit } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/constants";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

export function InvoiceTemplatesDataTable({ templates, isLoading }: { templates: any[], isLoading: boolean }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [templateToDelete, setTemplateToDelete] = useState<any | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${apiUrl}/api/invoice-templates/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete template");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Template deleted");
      setTemplateToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["invoice-templates"] });
    },
    onError: (err: any) => {
      toast.error(err.message);
      setTemplateToDelete(null);
    }
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

  if (templates?.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border rounded-md border-dashed bg-muted/10">
        <p className="text-sm text-muted-foreground">No invoice templates found. Create one to get started.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 md:hidden">
        {templates.map((template) => (
          <div key={template.id} className="border rounded-md bg-card p-3 flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg">{template.name}</h3>
                {template.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {template.description}
                  </p>
                )}
              </div>
              <div className="flex -mt-1 -mr-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={() => router.push(`/org-admin/invoice-templates/${template.id}`)}
                >
                  <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTemplateToDelete(template)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between bg-muted/30 border border-muted p-2 rounded-md mt-2">
              <Badge variant="outline" className="text-xs">{template.documentType}</Badge>
              <span className="text-xs text-muted-foreground">
                Updated {format(new Date(template.updatedAt), "MMM d, yyyy")}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block border rounded-md bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">{template.name}</TableCell>
                <TableCell className="text-muted-foreground max-w-xs truncate">
                  {template.description || "-"}
                </TableCell>
                <TableCell className="capitalize">
                  <Badge variant="outline">{template.documentType}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(template.updatedAt), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => router.push(`/org-admin/invoice-templates/${template.id}`)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Builder
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setTemplateToDelete(template)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the template <span className="font-semibold text-foreground">"{templateToDelete?.name}"</span>. 
              This action cannot be undone. Any active invoices using this template structure will retain their snapshot but cannot be regenerated with this template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate(templateToDelete?.id);
              }}
              variant="destructive"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Template"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
