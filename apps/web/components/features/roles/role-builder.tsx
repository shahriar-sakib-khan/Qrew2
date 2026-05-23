"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { usePermissionStore } from "@/store/use-permission-store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, Shield } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Field, 
  FieldLabel, 
  FieldError, 
  FieldGroup, 
  FieldSet, 
  FieldLegend, 
  FieldDescription 
} from "@/components/ui/field";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface RoleBuilderProps {
  roleId?: string; // undefined = create mode, string = edit mode
}

export function RoleBuilder({ roleId }: RoleBuilderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissionStore();
  const isEditMode = !!roleId;

  // Fetch existing role data (edit mode only)
  const { data: existingRole, isLoading: isLoadingRole } = useQuery({
    queryKey: ["org-role", roleId],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/roles/${roleId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch role");
      const data = await res.json();
      return data.role;
    },
    enabled: isEditMode,
  });

  // Fetch the global permission registry
  const { data: registry, isLoading: isLoadingRegistry } = useQuery({
    queryKey: ["permission-registry"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/roles/registry`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch registry");
      const data = await res.json();
      return data.permissions;
    },
  });

  // Group permissions by category
  const groupedPermissions = useMemo(() => {
    if (!registry) return {};
    return registry.reduce((acc: Record<string, any[]>, perm: any) => {
      if (!acc[perm.category]) acc[perm.category] = [];
      acc[perm.category].push(perm);
      return acc;
    }, {});
  }, [registry]);

  const form = useForm({
    defaultValues: {
      name: existingRole?.name || "",
      description: existingRole?.description || "",
      permissionKeys: existingRole?.permissionKeys || ([] as string[]),
    },
    onSubmit: async ({ value }) => {
      try {
        const url = isEditMode
          ? `${apiUrl}/api/workspaces/roles/${roleId}`
          : `${apiUrl}/api/workspaces/roles`;

        const res = await fetch(url, {
          method: isEditMode ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(value),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to save role");
        }

        toast.success(isEditMode ? "Role updated!" : "Role created!");
        queryClient.invalidateQueries({ queryKey: ["org-roles"] });
        router.push("/org-admin/roles");
      } catch (error: any) {
        toast.error(error.message);
      }
    },
  });

  // Re-initialize form when existing role data loads
  const [hasInitialized, setHasInitialized] = useState(false);
  if (isEditMode && existingRole && !hasInitialized) {
    form.setFieldValue("name", existingRole.name);
    form.setFieldValue("description", existingRole.description || "");
    form.setFieldValue("permissionKeys", existingRole.permissionKeys || []);
    setHasInitialized(true);
  }

  const isDataLoading = isLoadingRegistry || (isEditMode && isLoadingRole);

  return (
    <div className="flex flex-col gap-6">
      {/* Header with Back Button */}
      <div className="flex sm:flex-row flex-col justify-between items-start sm:items-center gap-4 border-b pb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/org-admin/roles")} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {isEditMode ? "Edit Role" : "Create New Role"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isEditMode
                ? "Modify role details and adjust permission boundaries."
                : "Define a new role with specific permission boundaries."}
            </p>
          </div>
        </div>
      </div>

      {isDataLoading ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-6"
        >
          {/* Role Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Role Details</CardTitle>
              <CardDescription>Set the name and purpose of this role.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form.Field
                name="name"
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && field.state.value.length < 2;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Role Name</FieldLabel>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="e.g. Shift Manager, Finance Lead"
                      />
                      {isInvalid && (
                        <p className="text-sm text-destructive">Role name must be at least 2 characters.</p>
                      )}
                    </Field>
                  );
                }}
              />

              <form.Field
                name="description"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Description (Optional)</FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Brief description of what this role can do"
                    />
                  </Field>
                )}
              />
            </CardContent>
          </Card>

          {/* Permission Matrix Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Permission Matrix
              </CardTitle>
              <CardDescription>
                Select the capabilities this role grants. Permissions you don't have yourself are marked as restricted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form.Field
                name="permissionKeys"
                mode="array"
                children={(field) => {
                  const selectedCount = field.state.value.length;

                  return (
                    <div className="space-y-6">
                      {/* Selection Counter */}
                      <div className="flex items-center justify-between px-1 min-h-[28px]">
                        <span className="text-sm text-muted-foreground">
                          {selectedCount} permission{selectedCount !== 1 ? "s" : ""} selected
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={`h-7 text-xs text-muted-foreground transition-opacity ${selectedCount > 0 ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                          onClick={() => field.handleChange([])}
                        >
                          Clear All
                        </Button>
                      </div>

                      {/* Category Sections */}
                      {Object.entries(groupedPermissions).map(([category, perms]: [string, any]) => {
                        const categoryPermsInSelection = perms.filter((p: any) =>
                          field.state.value.includes(p.key)
                        ).length;

                        return (
                          <div key={category} className="space-y-3">
                            <div className="flex items-center justify-between min-h-[24px]">
                              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                                {category}
                              </h4>
                              <div className="flex items-center gap-3">
                                {categoryPermsInSelection === perms.length ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-[105px] px-2 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      const keysToRemove = perms.map((p: any) => p.key);
                                      const newValue = field.state.value.filter((k: string) => !keysToRemove.includes(k));
                                      field.handleChange(newValue);
                                    }}
                                  >
                                    Clear Category
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-[105px] px-2 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      const current = new Set(field.state.value);
                                      perms.forEach((p: any) => {
                                        if (can(p.key)) current.add(p.key);
                                      });
                                      field.handleChange(Array.from(current));
                                    }}
                                  >
                                    Select All
                                  </Button>
                                )}
                                <span className="text-xs text-muted-foreground min-w-[30px] text-right inline-block">
                                  {categoryPermsInSelection}/{perms.length}
                               </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 border rounded-lg p-4 bg-muted/20">
                              {perms.map((perm: any) => {
                                const hasAccess = can(perm.key);
                                const isChecked = field.state.value.includes(perm.key);

                                return (
                                  <label
                                    key={perm.key}
                                    className={`flex items-center gap-3 p-2 rounded-md transition-colors cursor-pointer ${
                                      !hasAccess
                                        ? "opacity-50 cursor-not-allowed"
                                        : isChecked
                                        ? "bg-primary/5"
                                        : "hover:bg-muted/50"
                                    }`}
                                  >
                                    <Checkbox
                                      id={`perm-${perm.key}`}
                                      checked={isChecked}
                                      disabled={!hasAccess}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          field.pushValue(perm.key);
                                        } else {
                                          const index = field.state.value.indexOf(perm.key);
                                          if (index > -1) field.removeValue(index);
                                        }
                                      }}
                                    />
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 flex-1 min-w-0">
                                      <div className="flex items-center gap-2 sm:w-[220px] shrink-0">
                                        <span className={`text-sm ${isChecked ? "font-medium" : "font-normal"}`}>
                                          {perm.key}
                                        </span>
                                        {!hasAccess && (
                                          <span className="text-[10px] font-semibold uppercase tracking-wider text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                                            Restricted
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground leading-snug sm:flex-1">
                                        {perm.description}
                                      </p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
              />
            </CardContent>
          </Card>

          {/* Action Bar */}
          <form.Subscribe
            selector={(state) => [state.isSubmitting]}
            children={([isSubmitting]) => (
              <div className="flex items-center justify-end gap-3 border-t pt-6">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push("/org-admin/roles")}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isEditMode ? "Saving..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {isEditMode ? "Save Changes" : "Create Role"}
                    </>
                  )}
                </Button>
              </div>
            )}
          />
        </form>
      )}
    </div>
  );
}
