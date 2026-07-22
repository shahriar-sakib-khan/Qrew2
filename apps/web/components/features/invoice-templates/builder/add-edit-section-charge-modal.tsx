"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBuilderContext } from "./builder-context";

// ─── Token helpers ────────────────────────────────────────────────────────────
function processTokenSuffix(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/ /g, "_")
    .replace(/[^A-Z0-9_]/g, "")
    .replace(/^_+/, "")
    .replace(/_+/g, "_");
}

function validateSuffix(suffix: string): string | null {
  if (!suffix) return "Token suffix is required";
  if (suffix.startsWith("_")) return "Suffix cannot start with an underscore";
  if (suffix.endsWith("_")) return "Suffix cannot end with an underscore";
  if (/__/.test(suffix)) return "Consecutive underscores are not allowed";
  if (!/^[A-Z0-9_]+$/.test(suffix)) return "Only letters A–Z, digits 0–9, and underscore are allowed";
  return null;
}

function formatTokenToLabel(token: string): string {
  return token
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Modal for adding a section-level charge.
 *
 * ADD flow (token-first, identical to AddEditRowModal / AddRowChargeModal):
 *   1. User enters the charge token suffix.
 *   2. The full charge token is constructed as: SEC_{sectionToken}_{suffix}
 *   3. Label is auto-generated from the suffix.
 *   4. Formula is configured inline after creation (via the formula bar / label click).
 *
 * EDIT flow (full form, same as before — label + formula base/rest):
 *   All fields are available for editing the existing charge.
 */
export function AddEditSectionChargeModal({
  isOpen,
  onClose,
  sectionId,
  sectionToken,
  editCharge,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  sectionId: string;
  sectionToken: string;
  editCharge?: any;
  onSuccess?: () => void;
}) {
  const { apiBasePath } = useBuilderContext();
  const isEdit = !!editCharge;

  // ── Mode state ──────────────────────────────────────────────────────────────
  const [suffix, setSuffix] = useState("");
  const [tokenError, setTokenError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Prefix for section charge tokens
  const prefix = `SEC_${sectionToken}_`;
  const fullToken = suffix ? `${prefix}${suffix}` : "";

  useEffect(() => {
    if (!isOpen) return;
    if (isEdit && editCharge.chargeToken) {
      setSuffix(editCharge.chargeToken.startsWith(prefix) ? editCharge.chargeToken.replace(prefix, "") : editCharge.chargeToken);
      setTokenError("");
    } else {
      setSuffix("");
      setTokenError("");
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen, isEdit, editCharge, prefix]);

  // ── Mutations ───────────────────────────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${apiBasePath}/sections/${sectionId}/section-charges`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            chargeToken: fullToken,
            label: formatTokenToLabel(suffix),
            subDescription: null,
            tags: [],
            qualifier: null,
            formulaBase: "BASE",
            formulaRest: "* 1",
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) setTokenError(data.error ?? "Token already in use");
        throw new Error(data.error ?? "Failed to add section charge");
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Section charge added");
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      if (!err.message?.includes("Token") && !err.message?.includes("token")) {
        toast.error(err.message ?? "Failed to add section charge");
      }
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${apiBasePath}/sections/${sectionId}/section-charges/${editCharge.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            chargeToken: fullToken,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update section charge");
      return data;
    },
    onSuccess: () => {
      toast.success("Section charge updated");
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      if (!err.message?.includes("required")) {
        toast.error(err.message ?? "Failed to update section charge");
      }
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTokenError("");
    const err = validateSuffix(suffix);
    if (err) { setTokenError(err); return; }

    if (isEdit) {
      editMutation.mutate();
    } else {
      addMutation.mutate();
    }
  };

  const handleSuffixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSuffix(processTokenSuffix(e.target.value));
    setTokenError("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === " ") {
      e.preventDefault();
      const input = e.currentTarget;
      const pos = input.selectionStart ?? input.value.length;
      const before = input.value.slice(0, pos);
      const after = input.value.slice(input.selectionEnd ?? pos);
      if (before && !before.endsWith("_")) {
        setSuffix(processTokenSuffix(before + "_" + after));
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.closest("form")?.requestSubmit();
    }
  };

  const isPending = addMutation.isPending || editMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Section Charge" : "Add Section Charge"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Token suffix input ── */}
          <div className="space-y-1.5">
            <Label htmlFor="sectionChargeTokenSuffix">Charge Token *</Label>
            <div className={cn(
              "flex items-center rounded-md border bg-background overflow-hidden",
              "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0",
              tokenError && "border-destructive focus-within:ring-destructive"
            )}>
              <span className="pl-3 pr-1 text-sm font-mono text-muted-foreground select-none shrink-0 bg-muted/40 h-9 flex items-center border-r">
                {prefix}
              </span>
              <input
                id="sectionChargeTokenSuffix"
                ref={inputRef}
                value={suffix}
                onChange={handleSuffixChange}
                onKeyDown={handleKeyDown}
                placeholder="PORT_LEVY"
                autoComplete="off"
                spellCheck={false}
                className={cn(
                  "flex-1 h-9 px-3 text-sm font-mono tracking-wide bg-transparent",
                  "border-none outline-none focus:outline-none",
                )}
              />
            </div>
            {tokenError ? (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" /> {tokenError}
              </p>
            ) : fullToken ? (
              <p className="text-[11px] text-muted-foreground/50">
                Token:{" "}
                <code className="font-mono bg-muted/50 px-1 rounded">{fullToken}</code>
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground/40">
                Letters A–Z, digits 0–9, underscore. Space auto-converts to _.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isEdit ? "Save changes" : "Add charge"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
