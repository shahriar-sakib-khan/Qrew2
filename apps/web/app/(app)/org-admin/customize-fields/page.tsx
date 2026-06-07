"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/constants";
import { CustomFieldsDataTable } from "@/components/features/custom-fields/custom-fields-data-table";
import { AddCustomFieldModal } from "@/components/features/custom-fields/add-custom-field-modal";
import { AddExpenseCategoryModal } from "@/components/features/expense-categories/add-expense-category-modal";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

const SYSTEM_FIELDS = [
  // Client System Fields
  { id: "sys-client-name", entityType: "client" as const, fieldName: "Name", fieldKey: "name", fieldType: "text", isRequired: true, options: null, isSeeded: true, isSystem: true },
  { id: "sys-client-status", entityType: "client" as const, fieldName: "Status", fieldKey: "status", fieldType: "single_select", isRequired: true, options: ["active", "lead", "archived"], isSeeded: true, isSystem: true },
  // Project System Fields
  { id: "sys-project-name", entityType: "project" as const, fieldName: "Name", fieldKey: "name", fieldType: "text", isRequired: true, options: null, isSeeded: true, isSystem: true },
  { id: "sys-project-client", entityType: "project" as const, fieldName: "Client", fieldKey: "clientId", fieldType: "single_select", isRequired: true, options: null, isSeeded: true, isSystem: true },
  { id: "sys-project-status", entityType: "project" as const, fieldName: "Status", fieldKey: "status", fieldType: "single_select", isRequired: true, options: ["planning", "active", "completed", "on_hold"], isSeeded: true, isSystem: true },
  // Staff System Fields
  { id: "sys-staff-name", entityType: "staff" as const, fieldName: "Name", fieldKey: "name", fieldType: "text", isRequired: true, options: null, isSeeded: true, isSystem: true },
  { id: "sys-staff-email", entityType: "staff" as const, fieldName: "Email", fieldKey: "email", fieldType: "text", isRequired: true, options: null, isSeeded: true, isSystem: true },
  { id: "sys-staff-role", entityType: "staff" as const, fieldName: "System Role", fieldKey: "role", fieldType: "single_select", isRequired: true, options: ["user", "admin", "super_admin"], isSeeded: true, isSystem: true },
];

export default function CustomizeFieldsPage() {
  const [isAddFieldModalOpen, setIsAddFieldModalOpen] = useState(false);
  const [activeEntityType, setActiveEntityType] = useState<"client" | "project" | "staff">("client");
  const [isAddExpenseCategoryOpen, setIsAddExpenseCategoryOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: customFields, isLoading: loadingFields } = useQuery({
    queryKey: ["custom-fields"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/custom-fields`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch custom fields");
      return res.json();
    },
  });

  const { data: orgSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ["org-settings"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/settings`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch organization settings");
      const data = await res.json();
      return data.metadata || {};
    },
  });

  const [clientFileColumns, setClientFileColumns] = useState<string[]>([]);
  const [clientViewColumns, setClientViewColumns] = useState<string[]>([]);
  
  useEffect(() => {
    if (orgSettings) {
      if (orgSettings.clientFileViewColumns) {
        setClientFileColumns(orgSettings.clientFileViewColumns);
      } else {
        setClientFileColumns(["sys-project-name", "sys-project-status", "arrival_date", "total_expenses"]);
      }
      
      if (orgSettings.clientViewColumns) {
        setClientViewColumns(orgSettings.clientViewColumns);
      } else {
        setClientViewColumns(["sys-client-name"]); // Default
      }
    }
  }, [orgSettings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${apiUrl}/api/workspaces/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ metadata: payload }),
      });
      if (!res.ok) throw new Error("Failed to update settings");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Settings saved successfully.");
      queryClient.invalidateQueries({ queryKey: ["org-settings"] });
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  const { data: expenseCategories, isLoading: loadingCategories } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/expense-categories`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch expense categories");
      return res.json();
    },
  });

  const allFields = [...SYSTEM_FIELDS, ...(customFields || [])];
  const clientFields = allFields.filter(f => f.entityType === "client");
  const projectFields = allFields.filter(f => f.entityType === "project");
  const staffFields = allFields.filter(f => f.entityType === "staff");

  const openAddFieldModal = (type: "client" | "project" | "staff") => {
    setActiveEntityType(type);
    setIsAddFieldModalOpen(true);
  };

  const handleToggleColumn = (fieldId: string) => {
    setClientFileColumns((prev) => 
      prev.includes(fieldId) 
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const handleToggleClientColumn = (fieldId: string) => {
    setClientViewColumns((prev) => 
      prev.includes(fieldId) 
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const handleSaveColumns = () => {
    updateSettingsMutation.mutate({ 
      clientFileViewColumns: clientFileColumns,
      clientViewColumns: clientViewColumns
    });
  };

  return (
    <div className="flex flex-col gap-10 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customize Fields</h1>
        <p className="text-muted-foreground mt-1">
          Configure custom schemas and manage customizable categories across your workspace.
        </p>
      </div>

      {/* CLIENT SCHEMA SECTION */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Client Schema</h2>
            <p className="text-sm text-muted-foreground">Fields that appear on Client records.</p>
          </div>
          <Button variant="outline" onClick={() => openAddFieldModal("client")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Client Field
          </Button>
        </div>
        <CustomFieldsDataTable fields={clientFields} isLoading={loadingFields} />
      </section>

      {/* PROJECT SCHEMA SECTION */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Project / File Schema</h2>
            <p className="text-sm text-muted-foreground">Fields that appear on Project and File records.</p>
          </div>
          <Button variant="outline" onClick={() => openAddFieldModal("project")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Project Field
          </Button>
        </div>
        <CustomFieldsDataTable fields={projectFields} isLoading={loadingFields} />
      </section>

      {/* STAFF SCHEMA SECTION */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Staff Schema</h2>
            <p className="text-sm text-muted-foreground">Fields that appear on Staff and Employee profiles.</p>
          </div>
          <Button variant="outline" onClick={() => openAddFieldModal("staff")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Staff Field
          </Button>
        </div>
        <CustomFieldsDataTable fields={staffFields} isLoading={loadingFields} />
      </section>

      {/* EXPENSE CATEGORIES SECTION */}
      <section className="space-y-4 pt-4 border-t border-dashed">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Expense Categories</h2>
            <p className="text-sm text-muted-foreground">Categories for logging financial expenses.</p>
          </div>
          <Button variant="outline" onClick={() => setIsAddExpenseCategoryOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </div>
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingCategories ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    Loading categories...
                  </TableCell>
                </TableRow>
              ) : expenseCategories?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                    No expense categories found.
                  </TableCell>
                </TableRow>
              ) : (
                expenseCategories?.map((cat: any) => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell>{cat.description || "-"}</TableCell>
                    <TableCell>{format(new Date(cat.createdAt), "MMM d, yyyy")}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* CLIENT DIRECTORY FILE SETTINGS */}
      <section className="space-y-4 pt-4 border-t border-dashed">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Client Directory File Columns</h2>
            <p className="text-sm text-muted-foreground">Select which fields should be visible when viewing a client's files.</p>
          </div>
          <Button onClick={handleSaveColumns} disabled={updateSettingsMutation.isPending}>
            {updateSettingsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Preferences
          </Button>
        </div>
        <div className="rounded-md border bg-card p-4">
          {loadingSettings || loadingFields ? (
            <p className="text-sm text-muted-foreground">Loading settings...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projectFields.map((field) => (
                <div key={field.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`col-${field.id}`} 
                    checked={clientFileColumns.includes(field.id)}
                    onCheckedChange={() => handleToggleColumn(field.id)}
                  />
                  <Label htmlFor={`col-${field.id}`} className="font-normal cursor-pointer">
                    {field.fieldName} {field.isSystem && <span className="text-xs text-muted-foreground ml-1">(System)</span>}
                  </Label>
                </div>
              ))}
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="col-total_expenses" 
                  checked={clientFileColumns.includes("total_expenses")}
                  onCheckedChange={() => handleToggleColumn("total_expenses")}
                />
                <Label htmlFor="col-total_expenses" className="font-normal cursor-pointer">
                  Total Expenses <span className="text-xs text-muted-foreground ml-1">(System)</span>
                </Label>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CLIENT DIRECTORY COLUMNS SETTINGS */}
      <section className="space-y-4 pt-4 border-t border-dashed">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Client Directory Columns</h2>
            <p className="text-sm text-muted-foreground">Select which fields should be visible when viewing the client directory table.</p>
          </div>
          <Button onClick={handleSaveColumns} disabled={updateSettingsMutation.isPending}>
            {updateSettingsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Preferences
          </Button>
        </div>
        <div className="rounded-md border bg-card p-4">
          {loadingSettings || loadingFields ? (
            <p className="text-sm text-muted-foreground">Loading settings...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clientFields.map((field) => (
                <div key={field.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`client-col-${field.id}`} 
                    checked={clientViewColumns.includes(field.id)}
                    onCheckedChange={() => handleToggleClientColumn(field.id)}
                  />
                  <Label htmlFor={`client-col-${field.id}`} className="font-normal cursor-pointer">
                    {field.fieldName} {field.isSystem && <span className="text-xs text-muted-foreground ml-1">(System)</span>}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <AddCustomFieldModal 
        isOpen={isAddFieldModalOpen} 
        onClose={() => setIsAddFieldModalOpen(false)}
        defaultEntity={activeEntityType}
      />
      <AddExpenseCategoryModal 
        isOpen={isAddExpenseCategoryOpen} 
        onClose={() => setIsAddExpenseCategoryOpen(false)} 
      />
    </div>
  );
}
