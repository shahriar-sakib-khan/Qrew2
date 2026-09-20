"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Loader2, Check, X, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/constants";
import { CustomFieldsDataTable } from "@/components/features/custom-fields/custom-fields-data-table";
import { AddCustomFieldModal } from "@/components/features/custom-fields/add-custom-field-modal";
import { AddExpenseCategoryModal } from "@/components/features/expense-categories/add-expense-category-modal";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  { id: "sys-client-email", entityType: "client" as const, fieldName: "Email", fieldKey: "email", fieldType: "text", isRequired: false, options: null, isSeeded: true, isSystem: true },
  // Project System Fields
  { id: "sys-project-name", entityType: "project" as const, fieldName: "Name", fieldKey: "name", fieldType: "text", isRequired: true, options: null, isSeeded: true, isSystem: true },
  { id: "sys-project-client", entityType: "project" as const, fieldName: "Client", fieldKey: "clientId", fieldType: "single_select", isRequired: true, options: null, isSeeded: true, isSystem: true },
  { id: "sys-project-status", entityType: "project" as const, fieldName: "Status", fieldKey: "status", fieldType: "single_select", isRequired: true, options: ["planning", "active", "completed", "on_hold"], isSeeded: true, isSystem: true },
  // Staff System Fields
  { id: "sys-staff-name", entityType: "staff" as const, fieldName: "Name", fieldKey: "name", fieldType: "text", isRequired: true, options: null, isSeeded: true, isSystem: true },
  { id: "sys-staff-email", entityType: "staff" as const, fieldName: "Email", fieldKey: "email", fieldType: "text", isRequired: true, options: null, isSeeded: true, isSystem: true },
  { id: "sys-staff-role", entityType: "staff" as const, fieldName: "System Role", fieldKey: "role", fieldType: "single_select", isRequired: true, options: ["user", "admin", "super_admin"], isSeeded: true, isSystem: true },
];

function ExpenseCategoryRow({ cat, isShown, onToggleShow }: { cat: any, isShown: boolean, onToggleShow: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(cat.name);
  const [description, setDescription] = useState(cat.description || "");
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${apiUrl}/api/expense-categories/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update category");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Category updated successfully.");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${apiUrl}/api/expense-categories/${cat.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete category");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Category deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${cat.name}"?`)) {
      deleteMutation.mutate();
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium">
        {isEditing ? (
          <Input 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            className="h-8 w-full text-sm"
          />
        ) : (
          cat.name
        )}
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="font-mono text-xs text-muted-foreground">
          CAT_{cat.tokenKey}
        </Badge>
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Input 
            value={description} 
            onChange={(e) => setDescription(e.target.value)}
            className="h-8 w-full text-sm"
          />
        ) : (
          cat.description || "-"
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center">
          <Checkbox 
            checked={isShown} 
            onCheckedChange={onToggleShow} 
            aria-label="Toggle visibility"
          />
        </div>
      </TableCell>
      <TableCell className="text-right">
        {isEditing ? (
          <div className="flex items-center justify-end gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => { setIsEditing(false); setName(cat.name); setDescription(cat.description || ""); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-600" disabled={deleteMutation.isPending} onClick={handleDelete}>
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

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

  const [clientColumns, setClientColumns] = useState<string[]>([]);
  const [projectColumns, setProjectColumns] = useState<string[]>([]);
  const [staffColumns, setStaffColumns] = useState<string[]>([]);
  const [categoryColumns, setCategoryColumns] = useState<string[]>([]);
  
  useEffect(() => {
    if (orgSettings) {
      setClientColumns(orgSettings.clientColumns || ["sys-client-name", "sys-client-email"]);
      setProjectColumns(orgSettings.projectColumns || ["sys-project-name", "sys-project-status", "total_expenses"]);
      setStaffColumns(orgSettings.staffColumns || ["sys-staff-name", "sys-staff-email", "sys-staff-role"]);
      setCategoryColumns(orgSettings.categoryColumns || []); // Default to empty if none saved (or we can initialize with fetched categories later)
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

  // Handle initialization of categoryColumns when categories are loaded for the first time
  useEffect(() => {
    if (expenseCategories && orgSettings && !orgSettings.categoryColumns) {
       setCategoryColumns(expenseCategories.map((c: any) => c.id));
    }
  }, [expenseCategories, orgSettings]);

  const allFields = [...SYSTEM_FIELDS, ...(customFields || [])];
  const clientFields = allFields.filter(f => f.entityType === "client");
  const projectFields = allFields.filter(f => f.entityType === "project");
  const staffFields = allFields.filter(f => f.entityType === "staff");

  const openAddFieldModal = (type: "client" | "project" | "staff") => {
    setActiveEntityType(type);
    setIsAddFieldModalOpen(true);
  };

  const handleToggleColumn = (type: "client" | "project" | "staff" | "category", fieldId: string) => {
    let newSettings: any = {
      clientColumns,
      projectColumns,
      staffColumns,
      categoryColumns,
    };

    if (type === "client") {
      const updated = clientColumns.includes(fieldId) ? clientColumns.filter(id => id !== fieldId) : [...clientColumns, fieldId];
      setClientColumns(updated);
      newSettings.clientColumns = updated;
    } else if (type === "project") {
      const updated = projectColumns.includes(fieldId) ? projectColumns.filter(id => id !== fieldId) : [...projectColumns, fieldId];
      setProjectColumns(updated);
      newSettings.projectColumns = updated;
    } else if (type === "staff") {
      const updated = staffColumns.includes(fieldId) ? staffColumns.filter(id => id !== fieldId) : [...staffColumns, fieldId];
      setStaffColumns(updated);
      newSettings.staffColumns = updated;
    } else if (type === "category") {
      const updated = categoryColumns.includes(fieldId) ? categoryColumns.filter(id => id !== fieldId) : [...categoryColumns, fieldId];
      setCategoryColumns(updated);
      newSettings.categoryColumns = updated;
    }

    // Auto-save when toggled
    updateSettingsMutation.mutate(newSettings);
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
        <CustomFieldsDataTable 
          fields={clientFields} 
          isLoading={loadingFields} 
          shownColumns={clientColumns}
          onToggleShow={(id) => handleToggleColumn("client", id)}
        />
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
        <CustomFieldsDataTable 
          fields={projectFields} 
          isLoading={loadingFields} 
          shownColumns={projectColumns}
          onToggleShow={(id) => handleToggleColumn("project", id)}
        />
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
        <CustomFieldsDataTable 
          fields={staffFields} 
          isLoading={loadingFields} 
          shownColumns={staffColumns}
          onToggleShow={(id) => handleToggleColumn("staff", id)}
        />
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
                <TableHead>Token</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Shown</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingCategories ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Loading categories...
                  </TableCell>
                </TableRow>
              ) : expenseCategories?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No expense categories found.
                  </TableCell>
                </TableRow>
              ) : (
                expenseCategories?.map((cat: any) => (
                  <ExpenseCategoryRow 
                    key={cat.id} 
                    cat={cat} 
                    isShown={categoryColumns.includes(cat.id)}
                    onToggleShow={() => handleToggleColumn("category", cat.id)}
                  />
                ))
              )}
            </TableBody>
          </Table>
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
