"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/constants";
import { CustomFieldsDataTable } from "@/components/features/custom-fields/custom-fields-data-table";
import { AddCustomFieldModal } from "@/components/features/custom-fields/add-custom-field-modal";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SYSTEM_FIELDS = [
  { id: "sys-client-name", entityType: "client" as const, fieldName: "Name", fieldKey: "name", fieldType: "text", isRequired: true, options: null, isSeeded: true, isSystem: true },
  { id: "sys-client-status", entityType: "client" as const, fieldName: "Status", fieldKey: "status", fieldType: "single_select", isRequired: true, options: ["active", "lead", "archived"], isSeeded: true, isSystem: true },
  { id: "sys-project-name", entityType: "project" as const, fieldName: "Name", fieldKey: "name", fieldType: "text", isRequired: true, options: null, isSeeded: true, isSystem: true },
  { id: "sys-project-client", entityType: "project" as const, fieldName: "Client", fieldKey: "clientId", fieldType: "single_select", isRequired: true, options: null, isSeeded: true, isSystem: true },
  { id: "sys-project-status", entityType: "project" as const, fieldName: "Status", fieldKey: "status", fieldType: "single_select", isRequired: true, options: ["planning", "active", "completed", "on_hold"], isSeeded: true, isSystem: true },
];

export default function CustomFieldsPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"client" | "project">("client");

  const { data: customFields, isLoading } = useQuery({
    queryKey: ["custom-fields"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/custom-fields`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch custom fields");
      return res.json();
    },
  });

  const allFields = [...SYSTEM_FIELDS, ...(customFields || [])];
  const clientFields = allFields.filter(f => f.entityType === "client");
  const projectFields = allFields.filter(f => f.entityType === "project");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Custom Fields</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define custom data fields to extend your workspace schema for clients and projects.
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Field
        </Button>
      </div>

      <Tabs defaultValue="client" value={activeTab} onValueChange={(val) => setActiveTab(val as "client" | "project")} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="client">Client Schema</TabsTrigger>
          <TabsTrigger value="project">Project Schema</TabsTrigger>
        </TabsList>
        <TabsContent value="client">
          <CustomFieldsDataTable fields={clientFields} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="project">
          <CustomFieldsDataTable fields={projectFields} isLoading={isLoading} />
        </TabsContent>
      </Tabs>

      <AddCustomFieldModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        defaultEntity={activeTab}
      />
    </div>
  );
}
