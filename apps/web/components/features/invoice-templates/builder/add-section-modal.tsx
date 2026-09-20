"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/constants";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Convert a human name into the token suffix (UPPER_SNAKE, no SECTION_ prefix). */
function toTokenSuffix(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Derive the next default name (A, B, C … Z, AA, AB … AZ, BA …) from
 * the existing sections.
 */
function nextDefaultName(existingSections: any[]): string {
  const usedNames = new Set(
    (existingSections || [])
      .map((s: any) => (s.displayName ?? "").trim().toUpperCase())
      .filter(Boolean)
  );

  // Try single letters first
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i); // A–Z
    if (!usedNames.has(letter)) return letter;
  }

  // Then two-letter combos AA, AB, …
  for (let i = 0; i < 26; i++) {
    for (let j = 0; j < 26; j++) {
      const combo =
        String.fromCharCode(65 + i) + String.fromCharCode(65 + j);
      if (!usedNames.has(combo)) return combo;
    }
  }

  return "SECTION";
}

// ─── component ───────────────────────────────────────────────────────────────

export function AddSectionModal({
  isOpen,
  onClose,
  templateId,
  insertAtIndex,
  existingSections,
  editSection,
}: {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  insertAtIndex?: number;
  existingSections?: any[];
  editSection?: any;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editSection;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // Token is always derived — never directly edited by the user
  const [tokenSuffix, setTokenSuffix] = useState("");

  // Seed form values when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (editSection) {
      setName(editSection.displayName ?? "");
      setDescription(editSection.description ?? "");
      setTokenSuffix(
        // strip the SECTION_ prefix to display just the suffix
        (editSection.sectionToken ?? "").replace(/^SECTION_/, "")
      );
    } else {
      const defaultName = nextDefaultName(existingSections ?? []);
      setName(defaultName);
      setTokenSuffix(toTokenSuffix(defaultName));
      setDescription("");
    }
  }, [isOpen, editSection, existingSections]);

  // While creating, keep token in sync with name
  useEffect(() => {
    if (!isEdit) {
      setTokenSuffix(toTokenSuffix(name));
    }
  }, [name, isEdit]);

  const fullToken = tokenSuffix ? `SECTION_${tokenSuffix}` : "";

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const res = await fetch(
          `${apiUrl}/api/invoice-templates/${templateId}/sections/${editSection.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              displayName: name || null,
              description: description || null,
            }),
          }
        );
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to update section");
        }
        return res.json();
      }

      // Create — shift existing sections at or above insertAtIndex
      const atIdx = insertAtIndex ?? (existingSections?.length ?? 0);
      const toShift = (existingSections ?? []).filter(
        (s: any) => s.sortOrder >= atIdx
      );

      for (const sec of [...toShift].sort(
        (a, b) => b.sortOrder - a.sortOrder
      )) {
        await fetch(
          `${apiUrl}/api/invoice-templates/${templateId}/sections/${sec.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ orderIndex: sec.sortOrder + 1 }),
          }
        );
      }

      const res = await fetch(
        `${apiUrl}/api/invoice-templates/${templateId}/sections`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            displayName: name || null,
            description: description || null,
            // Send the full SECTION_X token so the server stores it as-is
            sectionToken: fullToken || null,
            orderIndex: atIdx,
          }),
        }
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to create section");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(isEdit ? "Section updated" : "Section created");
      onClose();
      queryClient.invalidateQueries({
        queryKey: ["template-sections", templateId],
      });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Edit / Add Section</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-3 pt-1"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="sec-name" className="text-sm">
              Name
            </Label>
            <Input
              id="sec-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="e.g. Port Costs"
              className="h-9"
            />
          </div>

          {/* Token — read-only display */}
          <div className="space-y-1.5">
            <div
              className="flex items-center h-9 px-3 rounded-md border border-border bg-muted/30 text-sm font-mono text-muted-foreground select-all"
            >
              <span className="text-foreground/40 mr-1">Token:</span>
              <span>{fullToken || <span className="italic opacity-50">SECTION_…</span>}</span>
            </div>
            {isEdit && (
              <p className="text-[11px] text-muted-foreground">
                (token can&apos;t be changed if editing)
              </p>
            )}
          </div>

          {/* Description (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="sec-desc" className="text-sm">
              Description{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="sec-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder=""
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              )}
              {isEdit ? "Save" : "Add Section"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
