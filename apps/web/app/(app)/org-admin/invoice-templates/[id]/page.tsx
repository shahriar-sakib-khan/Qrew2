"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TemplateBuilderWorkspace } from "@/components/features/invoice-templates/builder/template-builder-workspace";
import { TemplateTokenPool } from "@/components/features/invoice-templates/builder/template-token-pool";

export default function TemplateBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;
  const [tokenPoolOpen, setTokenPoolOpen] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(0);

  const { data: template, isLoading } = useQuery({
    queryKey: ["invoice-templates", templateId],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/invoice-templates/${templateId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch template");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="w-96 h-12" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4">
        <p>Template not found.</p>
        <Button onClick={() => router.push("/org-admin/invoice-templates")}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] -m-4 md:-m-6 lg:-m-8">
      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background z-10 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/org-admin/invoice-templates")}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold leading-tight truncate">
            {template.name}
          </h1>
          <p className="text-xs text-muted-foreground truncate">
            {template.description || "No description"}
          </p>
        </div>

        {/* Font Zoom Controls */}
        <div className="flex items-center gap-1 border border-border rounded-md px-1 h-8 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            onClick={() => setZoomLevel(z => Math.max(z - 1, -4))}
            title="Decrease Font Size"
          >
            <span className="text-lg leading-none font-medium mb-1">-</span>
          </Button>
          <span className="text-xs font-mono w-4 text-center select-none text-muted-foreground">
            {zoomLevel > 0 ? `+${zoomLevel}` : zoomLevel}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            onClick={() => setZoomLevel(z => Math.min(z + 1, 8))}
            title="Increase Font Size"
          >
            <span className="text-lg leading-none font-medium mb-1">+</span>
          </Button>
        </div>

        {/* Token Pool toggle — always visible */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTokenPoolOpen((v) => !v)}
          className="shrink-0 gap-2 text-xs h-8 ml-2"
          title={tokenPoolOpen ? "Hide Token Pool" : "Show Token Pool"}
        >
          {tokenPoolOpen ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRightOpen className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Tokens</span>
        </Button>
      </div>

      {/* ── Split panes ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile backdrop for Token Pool */}
        {tokenPoolOpen && (
          <div
            className="md:hidden absolute inset-0 z-30 bg-background/60 backdrop-blur-sm"
            onClick={() => setTokenPoolOpen(false)}
          />
        )}

        {/* Builder workspace — expands to fill when token pool is hidden */}
        <div
          className={cn(
            "flex flex-col h-full bg-muted/20 overflow-y-auto transition-all duration-200 flex-1 min-w-0",
            tokenPoolOpen && "md:border-r md:border-border"
          )}
        >
          <TemplateBuilderWorkspace templateId={templateId} tokenPoolOpen={tokenPoolOpen} zoomLevel={zoomLevel} />
        </div>

        {/* Token pool — collapsible */}
        <div
          className={cn(
            "h-full bg-background border-l border-border overflow-hidden transition-all duration-200",
            tokenPoolOpen
              ? "flex w-64 lg:w-72 xl:w-80 shrink-0"
              : "hidden",
            // Absolute drawer on small screens, relative panel on desktop
            "absolute md:relative inset-y-0 right-0 z-40 md:z-0 shadow-2xl md:shadow-none"
          )}
        >
          <TemplateTokenPool templateId={templateId} zoomLevel={zoomLevel} />
        </div>
      </div>
    </div>
  );
}
