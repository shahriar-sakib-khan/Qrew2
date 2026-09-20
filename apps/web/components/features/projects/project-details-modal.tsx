"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/constants";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, FileText, Loader2, UploadCloud } from "lucide-react";
import { useState, useRef } from "react";
import { AddExpenseModal } from "@/components/features/financials/add-expense-modal";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ProjectDetailsModalProps {
  project: any;
  onClose: () => void;
}

export function ProjectDetailsModal({ project, onClose }: ProjectDetailsModalProps) {
  const queryClient = useQueryClient();
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch expenses for this project
  const { data: expenses, isLoading: loadingExpenses } = useQuery({
    queryKey: ["expenses", project?.id],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/expenses?projectId=${project.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch expenses");
      const allExpenses = await res.json();
      return allExpenses.filter((e: any) => e.projectId === project.id);
    },
    enabled: !!project,
  });

  // Fetch attachments for this project
  const { data: attachments, isLoading: loadingAttachments } = useQuery({
    queryKey: ["project-attachments", project?.id],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/projects/${project.id}/attachments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch attachments");
      return res.json();
    },
    enabled: !!project,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // 1. Get presigned URL
      const presignRes = await fetch(`${apiUrl}/api/workspaces/projects/${project.id}/attachments/presigned`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          contentType: file.type || "application/octet-stream",
          fileName: file.name
        })
      });
      if (!presignRes.ok) throw new Error("Failed to init upload");
      const { url, publicUrl, fileId } = await presignRes.json();

      // 2. Upload to S3 (or R2)
      const uploadRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file
      });
      if (!uploadRes.ok) throw new Error("Failed to upload file to storage");

      // 3. Save to DB
      const saveRes = await fetch(`${apiUrl}/api/workspaces/projects/${project.id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fileId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || "application/octet-stream",
          fileUrl: publicUrl
        })
      });
      if (!saveRes.ok) throw new Error("Failed to save attachment metadata");
      
      return saveRes.json();
    },
    onSuccess: () => {
      toast.success("Attachment uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ["project-attachments", project?.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to upload attachment");
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500/10 text-green-500";
      case "completed": return "bg-blue-500/10 text-blue-500";
      case "archived": return "bg-gray-500/10 text-gray-500";
      case "pending": return "bg-yellow-500/10 text-yellow-500";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  if (!project) return null;

  return (
    <Dialog open={!!project} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div>
            <DialogTitle className="text-2xl font-bold">{project.name}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Client: {project.client?.name}</p>
          </div>
          <div className="flex items-center gap-3 pr-8">
            <Badge variant="outline" className={`capitalize border-0 ${getStatusColor(project.status)}`}>
              {project.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Read-Only Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block mb-1">Status</span>
                <span className="capitalize">{project.status}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Created At</span>
                <span>{format(new Date(project.createdAt), "MMM d, yyyy")}</span>
              </div>
              {Object.keys(project.customFields || {}).map((key) => (
                <div key={key}>
                  <span className="text-muted-foreground block mb-1 capitalize">{key.replace(/_/g, ' ')}</span>
                  <span>{project.customFields[key] || "-"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Attachments Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-lg font-semibold">Attachments</h3>
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
                {uploadMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
                Upload File
              </Button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
            </div>
            
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {loadingAttachments ? (
                <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
              ) : attachments?.length === 0 ? (
                <div className="text-center py-8 bg-muted/20 border border-dashed rounded-md text-muted-foreground text-sm">
                  No attachments yet.
                </div>
              ) : (
                attachments?.map((att: any) => (
                  <div key={att.id} className="flex items-center justify-between p-3 rounded-md border bg-card/50">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                      <div className="truncate">
                        <p className="text-sm font-medium truncate">{att.fileName}</p>
                        <p className="text-xs text-muted-foreground">{(att.fileSize / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" asChild>
                      <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" download>
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Expense History Section */}
        <div className="mt-4 space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="text-lg font-semibold">Expense History</h3>
            <Button size="sm" onClick={() => setIsExpenseModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Expense
            </Button>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingExpenses ? (
                  <TableRow><TableCell colSpan={4} className="text-center h-24">Loading...</TableCell></TableRow>
                ) : expenses?.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">No expenses recorded.</TableCell></TableRow>
                ) : (
                  expenses?.map((ex: any) => (
                    <TableRow key={ex.id}>
                      <TableCell>{format(new Date(ex.createdAt), "MMM d, yyyy")}</TableCell>
                      <TableCell>{ex.categoryName}</TableCell>
                      <TableCell>{ex.description || "-"}</TableCell>
                      <TableCell className="text-right font-medium">${Number(ex.amount).toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>

      <AddExpenseModal 
        isOpen={isExpenseModalOpen} 
        onClose={() => setIsExpenseModalOpen(false)} 
        defaultProjectId={project.id} 
      />
    </Dialog>
  );
}
