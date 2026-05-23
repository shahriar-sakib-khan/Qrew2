"use client";

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
  customFields: z.record(z.any()).default({}),
});

type FormValues = z.infer<typeof baseSchema>;

export function AddProjectModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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

  const clients = clientsData?.clients || [];

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      name: "",
      clientId: "",
      status: "planning",
      customFields: {},
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await fetch(`${apiUrl}/api/workspaces/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create project");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Project created successfully");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      reset();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function onSubmit(values: FormValues) {
    createMutation.mutate(values);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Project</DialogTitle>
          <DialogDescription>
            Create a new project. Custom fields configured in settings will appear below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          
          <div className="space-y-2">
            <Label>Project Name *</Label>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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

          <div className="pt-4 mt-4 border-t border-dashed">
            <h4 className="text-sm font-medium mb-4 text-muted-foreground">Additional Details</h4>
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
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
