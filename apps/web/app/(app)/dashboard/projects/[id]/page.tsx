"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { apiUrl } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { use } from "react";

export default function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses", projectId],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/expenses?projectId=${projectId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch expenses for this file");
      return res.json();
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">File Details</h1>
          <p className="text-muted-foreground">ID: {projectId}</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Expenses against this File</h2>
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Spent By</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24">Loading expenses...</TableCell></TableRow>
              ) : expenses?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24">No expenses logged for this file.</TableCell></TableRow>
              ) : (
                expenses?.map((ex: any) => (
                  <TableRow key={ex.id}>
                    <TableCell className="font-medium">{ex.spentBy || "Unknown"}</TableCell>
                    <TableCell>{ex.categoryName}</TableCell>
                    <TableCell>${Number(ex.amount).toFixed(2)}</TableCell>
                    <TableCell>{format(new Date(ex.createdAt), "MMM d, yyyy")}</TableCell>
                    <TableCell>{ex.description || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
