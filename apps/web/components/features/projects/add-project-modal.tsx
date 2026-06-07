"use client";

import { useEffect } from "react";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiUrl } from "@/lib/constants";
import { toast } from "sonner";
import { DynamicCustomFieldsRenderer } from "@/components/features/custom-fields/dynamic-custom-fields-renderer";

const baseSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  clientId: z.string().min(1, "Client is required"),
  status: z.enum(["planning", "active", "completed", "on_hold"]).default("planning"),
  customFields: z.record(z.string(), z.any()).default({}),
});

type FormValues = z.infer<typeof baseSchema>;

export function AddProjectModal({ isOpen, onClose, editProject }: { isOpen: boolean; onClose: () => void; editProject?: any }) {
  const queryClient = useQueryClient();

  const { data: customFieldDefs } = useQuery({
    queryKey: ["custom-fields", "project"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/custom-fields?entityType=project`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch custom fields");
      return res.json();
    },
    enabled: isOpen,
  });

  const { data: clientsData } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/clients`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
    enabled: isOpen,
  });

  const clients = Array.isArray(clientsData) ? clientsData : [];

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(baseSchema) as any,
    defaultValues: {
      name: "",
      clientId: "",
      status: "planning",
      customFields: {},
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (editProject) {
        reset({
          name: editProject.name,
          clientId: editProject.clientId,
          status: editProject.status,
          customFields: editProject.customFields || {},
        });
      } else {
        reset({
          name: "",
          clientId: "",
          status: "planning",
          customFields: {},
        });
      }
    }
  }, [isOpen, editProject, reset]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const url = editProject 
        ? `${apiUrl}/api/workspaces/projects/${editProject.id}`
        : `${apiUrl}/api/workspaces/projects`;
      const method = editProject ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${editProject ? "update" : "create"} project`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(`Project ${editProject ? "updated" : "created"} successfully`);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function onSubmit(values: FormValues) {
    saveMutation.mutate(values);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editProject ? "Edit File" : "Add New File"}</DialogTitle>
          <DialogDescription>
            {editProject ? "Update file details." : "Create a new file."} Custom fields configured in settings will appear below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          
          <div className="space-y-2">
            <Label>File Name *</Label>
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <Input placeholder="e.g. Website Redesign" {...field} />
              )}
            />
            {errors.name && <p className="text-[0.8rem] font-medium text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Client *</Label>
            <Controller
              control={control}
              name="clientId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.clientId && <p className="text-[0.8rem] font-medium text-destructive">{errors.clientId.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.status && <p className="text-[0.8rem] font-medium text-destructive">{errors.status.message}</p>}
          </div>

          <div className="mt-4">
            <DynamicCustomFieldsRenderer 
              control={control} 
              definitions={customFieldDefs || []} 
              basePath="customFields"
              errors={errors.customFields as any}
            />
          </div>

          <div className="flex justify-end pt-4 gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : (editProject ? "Save Changes" : "Create File")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
