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
import { Plus, Download, FileText, Loader2, UploadCloud, Settings2, Layout, ArrowRight } from "lucide-react";
import { useState, useRef, useMemo } from "react";
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
import { Can } from "@/components/features/auth/can";
import { ProjectDataDisplay } from "./project-data-display";
import { ProjectWorkflowBuilder } from "./project-workflow-builder";
import { EditStageDataModal } from "./edit-stage-data-modal";

interface ProjectDetailsModalProps {
  project: any;
  onClose: () => void;
}

export function ProjectDetailsModal({ project, onClose }: ProjectDetailsModalProps) {
  const queryClient = useQueryClient();
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [viewMode, setViewMode] = useState<"tabs" | "scrollspy">("tabs");
  const [editStageId, setEditStageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch statuses
  const { data: statuses, isLoading: loadingStatuses } = useQuery({
    queryKey: ["project-statuses"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/projects/statuses`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch statuses");
      return res.json();
    }
  });

  // Fetch custom fields
  const { data: customFields, isLoading: loadingFields } = useQuery({
    queryKey: ["custom-fields", "project"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/custom-fields?entityType=project`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch custom fields");
      return res.json();
    }
  });

  // Fetch expenses for this project
  const { data: expenses, isLoading: loadingExpenses } = useQuery({
    queryKey: ["expenses", project?.id],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/expenses?projectId=${project.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch expenses");
      const allExpenses = await res.json();
      return allExpenses.filter((e: any) => e.projectId === project.id);
    },
    enabled: !!project && !isAdminMode,
  });

  // Fetch attachments for this project
  const { data: attachments, isLoading: loadingAttachments } = useQuery({
    queryKey: ["project-attachments", project?.id],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/projects/${project.id}/attachments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch attachments");
      return res.json();
    },
    enabled: !!project && !isAdminMode,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
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

      const uploadRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file
      });
      if (!uploadRes.ok) throw new Error("Failed to upload file to storage");

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

  const changeStatusMutation = useMutation({
    mutationFn: async (newStatusId: string) => {
      const res = await fetch(`${apiUrl}/api/workspaces/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: project.name,
          clientId: project.clientId,
          status: newStatusId,
          customFields: project.customFields
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Stage advanced");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const currentStatusIndex = useMemo(() => {
    if (!statuses) return -1;
    return statuses.findIndex((s: any) => s.id === project?.status);
  }, [statuses, project?.status]);

  const nextStatus = useMemo(() => {
    if (!statuses || currentStatusIndex === -1) return null;
    return statuses[currentStatusIndex + 1] || null;
  }, [statuses, currentStatusIndex]);

  if (!project) return null;

  return (
    <Dialog open={!!project} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-4 shrink-0">
          <div>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              {project.name}
              {project.statusRelation && (
                <Badge variant="secondary" className="capitalize text-sm font-normal">
                  {project.statusRelation.name}
                </Badge>
              )}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Client: {project.client?.name}</p>
          </div>
          <div className="flex items-center gap-2 pr-8">
            <Can I="org:manage">
              <Button 
                variant={isAdminMode ? "default" : "outline"} 
                size="sm" 
                onClick={() => setIsAdminMode(!isAdminMode)}
              >
                <Settings2 className="w-4 h-4 mr-2" />
                {isAdminMode ? "Exit Admin Mode" : "Edit Workflow"}
              </Button>
            </Can>
            {!isAdminMode && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setViewMode(viewMode === "tabs" ? "scrollspy" : "tabs")}
                title="Toggle View Mode"
              >
                <Layout className="w-4 h-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        {loadingStatuses || loadingFields ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 py-4">
            {isAdminMode ? (
              <ProjectWorkflowBuilder />
            ) : (
              <div className="space-y-8">
                {/* Status Advancement */}
                {nextStatus && (
                  <div className="bg-primary/5 border border-primary/20 rounded-md p-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-primary">Next Stage: {nextStatus.name}</h4>
                      <p className="text-sm text-muted-foreground">Ready to advance this file to the next stage?</p>
                    </div>
                    <Button 
                      onClick={() => changeStatusMutation.mutate(nextStatus.id)}
                      disabled={changeStatusMutation.isPending}
                    >
                      Advance to {nextStatus.name} <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                )}

                {/* Data Display */}
                <ProjectDataDisplay 
                  project={project}
                  customFields={customFields || []}
                  projectStatuses={statuses || []}
                  viewMode={viewMode}
                  onEditFields={(statusId) => setEditStageId(statusId)}
                />

                {/* Attachments & Expenses (Rendered below scrollspy or tabs) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-8">
                  {/* Attachments */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                      <h3 className="text-lg font-semibold">Attachments</h3>
                      <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
                        {uploadMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
                        Upload
                      </Button>
                      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {loadingAttachments ? (
                        <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
                      ) : attachments?.length === 0 ? (
                        <div className="text-center py-8 bg-muted/20 border border-dashed rounded-md text-muted-foreground text-sm">
                          No attachments.
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

                  {/* Expenses */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                      <h3 className="text-lg font-semibold">Expense History</h3>
                      <Button size="sm" onClick={() => setIsExpenseModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" /> Add
                      </Button>
                    </div>
                    <div className="rounded-md border bg-card max-h-[200px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Desc</TableHead>
                            <TableHead className="text-right">Amt</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loadingExpenses ? (
                            <TableRow><TableCell colSpan={3} className="text-center h-24">Loading...</TableCell></TableRow>
                          ) : expenses?.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center h-24 text-muted-foreground">No expenses.</TableCell></TableRow>
                          ) : (
                            expenses?.map((ex: any) => (
                              <TableRow key={ex.id}>
                                <TableCell>{format(new Date(ex.createdAt), "MMM d, yy")}</TableCell>
                                <TableCell className="truncate max-w-[100px]">{ex.description || "-"}</TableCell>
                                <TableCell className="text-right font-medium">${Number(ex.amount).toFixed(2)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>

      <AddExpenseModal 
        isOpen={isExpenseModalOpen} 
        onClose={() => setIsExpenseModalOpen(false)} 
        defaultProjectId={project.id} 
      />

      {editStageId && (
        <EditStageDataModal 
          isOpen={!!editStageId}
          onClose={() => setEditStageId(null)}
          project={project}
          status={statuses?.find((s: any) => s.id === editStageId)}
          customFields={customFields || []}
        />
      )}
    </Dialog>
  );
}
