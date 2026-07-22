"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiUrl } from "@/lib/constants";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function GenerateInvoiceModal({ isOpen, onClose, projectId }: { isOpen: boolean; onClose: () => void; projectId: string }) {
  const router = useRouter();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isNavigating, setIsNavigating] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["invoice-templates"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/invoice-templates`, { credentials: "include" });
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
      if (!selectedTemplateId) throw new Error("Please select a template");

      const res = await fetch(`${apiUrl}/api/invoices/drafts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          sourceTemplateId: selectedTemplateId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        const error = new Error(data.error || "Failed to generate draft");
        (error as any).details = data.details;
        (error as any).stackTrace = data.stack;
        throw error;
      }
      return res.json();
    },
    onSuccess: (data) => {
      setIsNavigating(true);
      toast.success("Draft created — opening...");
      router.push(`/dashboard/invoices/drafts/${data.id}`);
    },
    onError: (error: any) => {
      toast.error(error.message + (error.details ? ` - ${error.details}` : ""));
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isNavigating && onClose()}>
      <DialogContent className="sm:max-w-[400px]" onInteractOutside={(e) => isNavigating && e.preventDefault()}>
        {isNavigating ? (
          // Navigation loading state — shown after Generate succeeds while Next.js transitions
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Opening draft editor...</p>
            <p className="text-xs text-muted-foreground">Loading invoice template and file data</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Generate Invoice</DialogTitle>
              <DialogDescription>
                Select a template to use for this file's invoice.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading templates...
                </div>
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
                  className="gap-2"
                >
                  {generateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {generateMutation.isPending ? "Generating..." : "Generate"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
