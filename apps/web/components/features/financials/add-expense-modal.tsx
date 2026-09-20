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
  categoryId: z.string().min(1, "Category is required"),
  projectId: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function AddExpenseModal({ isOpen, onClose, defaultProjectId }: { isOpen: boolean; onClose: () => void; defaultProjectId?: string }) {
  const queryClient = useQueryClient();

  const { data: categoriesData } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/expense-categories`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
    enabled: isOpen,
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/projects`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
    enabled: isOpen,
  });

  const categories = Array.isArray(categoriesData) ? categoriesData : [];
  const projects = Array.isArray(projectsData) ? projectsData : [];

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      amount: undefined, // using undefined to avoid 0 showing up empty, but will fallback to 0 in UI
      categoryId: "",
      projectId: defaultProjectId || "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await fetch(`${apiUrl}/api/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create expense");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Expense added successfully");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
          <DialogDescription>
            Record a new expense. It will be deducted from your wallet balance.
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
            <Label>Category *</Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.categoryId && <p className="text-[0.8rem] font-medium text-destructive">{errors.categoryId.message}</p>}
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

          <div className="space-y-2">
            <Label>Description</Label>
            <Controller
              control={control}
              name="description"
              render={({ field }) => (
                <Textarea placeholder="Optional description..." {...field} />
              )}
            />
          </div>

          <div className="flex justify-end pt-4 gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Add Expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
