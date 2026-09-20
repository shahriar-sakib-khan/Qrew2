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
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  projectId: z.string().optional(),
  purpose: z.string().min(1, "Purpose is required"),
});

type FormValues = z.infer<typeof schema>;

export function AddRequisitionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/projects`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
    enabled: isOpen,
  });

  const projects = Array.isArray(projectsData) ? projectsData : [];

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      amount: 0,
      projectId: "",
      purpose: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await fetch(`${apiUrl}/api/requisitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create requisition");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Requisition requested successfully");
      queryClient.invalidateQueries({ queryKey: ["requisitions"] });
      reset();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function onSubmit(values: FormValues) {
    const payload = {
      ...values,
      projectId: values.projectId === "none" ? undefined : values.projectId,
    };
    createMutation.mutate(payload);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Request Funds</DialogTitle>
          <DialogDescription>
            Submit a requisition request for an upcoming expense.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          
          <div className="space-y-2">
            <Label>Amount *</Label>
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <Input type="number" step="0.01" placeholder="0.00" {...field} />
              )}
            />
            {errors.amount && <p className="text-[0.8rem] font-medium text-destructive">{errors.amount.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Purpose *</Label>
            <Controller
              control={control}
              name="purpose"
              render={({ field }) => (
                <Textarea placeholder="What are these funds for?" {...field} />
              )}
            />
            {errors.purpose && <p className="text-[0.8rem] font-medium text-destructive">{errors.purpose.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>File / Project (Optional)</Label>
            <Controller
              control={control}
              name="projectId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a file/project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {projects.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex justify-end pt-4 gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
