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
import { Plus } from "lucide-react";
import { useState } from "react";
import { CreateInvoiceModal } from "@/components/features/financials/create-invoice-modal";

export default function InvoicesPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/invoices`, { credentials: "include" });
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground text-sm">Manage and track client invoices.</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Total Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24">Loading invoices...</TableCell></TableRow>
            ) : invoices?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24">No invoices found. Create one to get started.</TableCell></TableRow>
            ) : (
              invoices?.map((inv: any) => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
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

      <CreateInvoiceModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  );
}
