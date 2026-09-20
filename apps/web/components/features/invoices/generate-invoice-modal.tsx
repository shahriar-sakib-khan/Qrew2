"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiUrl } from "@/lib/constants";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function GenerateInvoiceModal({ isOpen, onClose, projectId }: { isOpen: boolean; onClose: () => void; projectId: string }) {
  const router = useRouter();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["invoice-templates"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/invoice-templates`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
    enabled: isOpen,
  });

  // Auto-select template if only one exists
  useEffect(() => {
    if (templates && templates.length === 1) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/invoices/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          sourceTemplateId: selectedTemplateId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate draft");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success("Draft created successfully");
      router.push(`/dashboard/invoices/drafts/${data.id}`);
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Generate Invoice</DialogTitle>
          <DialogDescription>
            Select a template to use for this file's invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading templates...</div>
          ) : templates?.length === 0 ? (
            <div className="text-sm text-destructive">No invoice templates found. Please create one first in Settings.</div>
          ) : (
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={onClose} disabled={generateMutation.isPending}>
              Cancel
            </Button>
            <Button 
              onClick={() => generateMutation.mutate()} 
              disabled={!selectedTemplateId || generateMutation.isPending}
            >
              {generateMutation.isPending ? "Generating..." : "Generate"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
