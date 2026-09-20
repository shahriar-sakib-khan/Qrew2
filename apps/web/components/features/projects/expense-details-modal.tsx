"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Receipt, Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Can } from "@/components/features/auth/can";
import { useState } from "react";
import { AddExpenseModal } from "@/components/features/financials/add-expense-modal";

interface ExpenseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  expenses: any[];
  loadingExpenses: boolean;
}

export function ExpenseDetailsModal({ isOpen, onClose, project, expenses, loadingExpenses }: ExpenseDetailsModalProps) {
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-muted-foreground" />
              Expense Details
            </DialogTitle>
          </DialogHeader>

          <Can
            I="finance:view_expenses"
            fallback={
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Receipt className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">Access Restricted</p>
                <p className="text-xs mt-1">You don&apos;t have permission to view expense data.</p>
              </div>
            }
          >
            <div className="flex justify-between items-center mt-2 mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Expense History for {project?.name}</h3>
              <Button size="sm" onClick={() => setIsAddExpenseOpen(true)} className="gap-1.5">
                <Plus className="w-4 h-4" />
                Add Expense
              </Button>
            </div>

            {loadingExpenses ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading expenses…
              </div>
            ) : !expenses || expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
                <Receipt className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No expenses recorded</p>
                <p className="text-xs mt-1">Click Add Expense to log one</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/50 z-10">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((ex: any) => (
                      <TableRow key={ex.id}>
                        <TableCell className="text-sm">{format(new Date(ex.createdAt), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-sm">{ex.description || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ex.category?.name || "—"}</TableCell>
                        <TableCell className="text-right font-medium text-sm">${Number(ex.amount).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Can>
        </DialogContent>
      </Dialog>

      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        defaultProjectId={project?.id}
      />
    </>
  );
}
