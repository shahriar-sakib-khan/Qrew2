"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiUrl } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function DraftEditorPage() {
  const params = useParams();
  const router = useRouter();
  const draftId = params.id as string;

  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const { data: draft, isLoading: draftLoading } = useQuery({
    queryKey: ["draft", draftId],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/invoices/drafts/${draftId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch draft");
      return res.json();
    },
  });

  const { data: preview, isLoading: previewLoading, refetch: refetchPreview } = useQuery({
    queryKey: ["draft-preview", draftId, overrides],
    queryFn: async () => {
      if (!draft) return null;
      
      // Inject overrides into draftRows before sending for preview
      const modifiedRows = JSON.parse(JSON.stringify(draft.draftSections || []));
      for (const section of modifiedRows) {
        for (const row of section.rows || []) {
          if (overrides[row.rowToken] !== undefined) {
            row.overriddenValue = overrides[row.rowToken];
          }
        }
      }

      const res = await fetch(`${apiUrl}/api/workspaces/invoices/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId: draft.projectId,
          templateId: draft.sourceTemplateId,
          draftRows: modifiedRows.length > 0 ? modifiedRows : undefined,
          headerFieldValues: draft.draftHeaderValues || {},
        }),
      });
      if (!res.ok) throw new Error("Failed to preview draft");
      return res.json();
    },
    enabled: !!draft,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Create new draftSections with overrides applied
      const newSections = JSON.parse(JSON.stringify(preview?.sections || draft?.draftSections || []));
      for (const section of newSections) {
        for (const row of section.rows || []) {
          if (overrides[row.rowToken] !== undefined) {
            row.overriddenValue = overrides[row.rowToken];
          }
        }
      }

      const res = await fetch(`${apiUrl}/api/workspaces/invoices/drafts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId: draft.projectId,
          sourceTemplateId: draft.sourceTemplateId,
          draftHeaderValues: draft.draftHeaderValues,
          draftSections: newSections,
        }),
      });
      if (!res.ok) throw new Error("Failed to save draft");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Draft saved");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const newSections = JSON.parse(JSON.stringify(preview?.sections || draft?.draftSections || []));
      for (const section of newSections) {
        for (const row of section.rows || []) {
          if (overrides[row.rowToken] !== undefined) {
            row.overriddenValue = overrides[row.rowToken];
          }
        }
      }

      const res = await fetch(`${apiUrl}/api/workspaces/invoices/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId: draft.projectId,
          clientId: draft.project?.clientId || "temp-client", // Fallback for now if no join
          documentType: "general",
          sourceTemplateId: draft.sourceTemplateId,
          draftRows: newSections,
          headerFieldValues: draft.draftHeaderValues || {},
          issuedToClientName: draft.project?.client?.name || "Client",
          currency: "USD",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to finalize invoice");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success("Invoice generated successfully");
      
      // Optionally delete the draft here
      fetch(`${apiUrl}/api/workspaces/invoices/drafts/${draftId}`, {
        method: "DELETE",
        credentials: "include",
      });

      router.push(`/dashboard/invoices`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleOverrideChange = (rowToken: string, value: string) => {
    setOverrides(prev => ({
      ...prev,
      [rowToken]: value,
    }));
  };

  if (draftLoading) return <div className="p-8">Loading draft...</div>;
  if (!draft) return <div className="p-8">Draft not found</div>;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-20">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Invoice Draft</h1>
            <p className="text-muted-foreground text-sm">Review calculated amounts and add manual overrides.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || finalizeMutation.isPending}>
            <Save className="h-4 w-4 mr-2" /> {saveMutation.isPending ? "Saving..." : "Save Draft"}
          </Button>
          <Button onClick={() => finalizeMutation.mutate()} disabled={finalizeMutation.isPending || saveMutation.isPending}>
            <CheckCircle className="h-4 w-4 mr-2" /> {finalizeMutation.isPending ? "Finalizing..." : "Finalize Invoice"}
          </Button>
        </div>
      </div>

      {previewLoading && !preview ? (
        <div className="text-center p-10 text-muted-foreground">Calculating invoice...</div>
      ) : (
        <div className="space-y-8">
          {preview?.sections?.map((section: any) => (
            <div key={section.id} className="border rounded-md bg-card">
              <div className="bg-muted px-4 py-2 font-semibold border-b">
                {section.name}
              </div>
              <div className="p-4 space-y-2">
                {section.rows?.map((row: any) => (
                  <div key={row.rowToken} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <div className="font-medium">{row.label}</div>
                      {row.subDescription && <div className="text-sm text-muted-foreground">{row.subDescription}</div>}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Calculated</div>
                        <div>{row.evaluatedValue !== null ? `$${Number(row.evaluatedValue).toFixed(2)}` : "-"}</div>
                      </div>
                      <div className="text-right w-32">
                        <div className="text-xs text-muted-foreground">Override</div>
                        <Input 
                          type="number"
                          placeholder="Manual value"
                          className="h-8"
                          value={overrides[row.rowToken] !== undefined ? overrides[row.rowToken] : (row.overriddenValue || "")}
                          onChange={(e) => handleOverrideChange(row.rowToken, e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex justify-end pt-4 border-t">
            <div className="text-right">
              <div className="text-lg text-muted-foreground">Grand Total</div>
              <div className="text-3xl font-bold">${Number(preview?.grandTotal || 0).toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
