"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/constants";
import { useState } from "react";
import { InvoiceTemplatesDataTable } from "@/components/features/invoice-templates/invoice-templates-data-table";
import { AddEditInvoiceTemplateModal } from "@/components/features/invoice-templates/add-invoice-template-modal";

export default function InvoiceTemplatesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["invoice-templates"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/invoice-templates`, { credentials: "include" });
      if (!res.ok) {
        const error = new Error("Failed to fetch templates");
        (error as any).status = res.status;
        throw error;
      }
      return res.json();
    },
  });

  return (
    <div className="flex flex-col gap-10 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoice Templates</h1>
          <p className="text-muted-foreground mt-1">
            Build and manage reusable invoice structures and formulas.
          </p>
        </div>
        <Button onClick={() => {
          setEditTemplate(null);
          setIsModalOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </div>

      <InvoiceTemplatesDataTable 
        templates={templates || []} 
        isLoading={isLoading} 
        onEdit={(template) => {
          setEditTemplate(template);
          setIsModalOpen(true);
        }}
      />

      <AddEditInvoiceTemplateModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        editTemplate={editTemplate}
      />
    </div>
  );
}
