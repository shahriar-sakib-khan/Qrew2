"use client";

import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/constants";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Pencil } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GenerateInvoiceModal } from "@/components/features/invoices/generate-invoice-modal";
import Link from "next/link";

export default function InvoicesPage() {
  const [activeTab, setActiveTab] = useState("ready");
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // 1. Fetch Projects (Ready to Bill)
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects", "ready-to-bill"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/projects`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
  });

  // 2. Fetch Drafts
  const { data: drafts, isLoading: draftsLoading } = useQuery({
    queryKey: ["invoice-drafts"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/invoices/drafts/list`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch drafts");
      return res.json();
    },
  });

  // 3. Fetch Finalized Invoices
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/invoices`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch invoices");
      return res.json();
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-green-500/10 text-green-500 hover:bg-green-500/20";
      case "open": return "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20";
      case "draft": return "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20";
      case "void": return "bg-red-500/10 text-red-500 hover:bg-red-500/20";
      case "uncollectible": return "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20";
      default: return "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20";
    }
  };

  const openGenerateModal = (projectId: string) => {
    setSelectedProjectId(projectId);
    setIsGenerateModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground text-sm">Manage and track client invoices.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="ready">Ready to Bill</TabsTrigger>
          <TabsTrigger value="drafts">Drafts</TabsTrigger>
          <TabsTrigger value="all">All Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="ready">
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectsLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center h-24">Loading files...</TableCell></TableRow>
                ) : projects?.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center h-24">No files found.</TableCell></TableRow>
                ) : (
                  projects?.map((project: any) => (
                    <TableRow key={project.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {project.name}
                          {project.invoiceCount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {project.invoiceCount} Invoice{project.invoiceCount > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{project.client?.name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{project.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openGenerateModal(project.id)}>
                          <FileText className="h-4 w-4 mr-2" /> Generate Invoice
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="drafts">
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Last Edited</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draftsLoading ? (
                  <TableRow><TableCell colSpan={3} className="text-center h-24">Loading drafts...</TableCell></TableRow>
                ) : drafts?.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center h-24">No drafts found.</TableCell></TableRow>
                ) : (
                  drafts?.map((draft: any) => (
                    <TableRow key={draft.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">{draft.project?.name || draft.projectId}</TableCell>
                      <TableCell>{draft.lastAutoSavedAt ? format(new Date(draft.lastAutoSavedAt), "MMM d, yyyy h:mm a") : "-"}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/dashboard/invoices/drafts/${draft.id}`}>
                          <Button variant="outline" size="sm">
                            <Pencil className="h-4 w-4 mr-2" /> Edit Draft
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="all">
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoicesLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center h-24">Loading invoices...</TableCell></TableRow>
                ) : invoices?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center h-24">No finalized invoices found.</TableCell></TableRow>
                ) : (
                  invoices?.map((inv: any) => (
                    <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">{inv.invoiceNumber || inv.documentNumber}</TableCell>
                      <TableCell>{inv.project?.name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize ${getStatusColor(inv.status)} border-0`}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{inv.issueDate ? format(new Date(inv.issueDate), "MMM d, yyyy") : "-"}</TableCell>
                      <TableCell>{inv.dueDate ? format(new Date(inv.dueDate), "MMM d, yyyy") : "-"}</TableCell>
                      <TableCell className="text-right font-bold">${Number(inv.totalAmount).toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {isGenerateModalOpen && selectedProjectId && (
        <GenerateInvoiceModal 
          isOpen={isGenerateModalOpen} 
          onClose={() => setIsGenerateModalOpen(false)} 
          projectId={selectedProjectId}
        />
      )}
    </div>
  );
}
