"use client";

import { Button } from "@/components/ui/button";
import { Plus, List, FolderTree } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { AddProjectModal } from "@/components/features/projects/add-project-modal";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/constants";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ListView } from "@/components/features/projects/list-view";
import { FolderView } from "@/components/features/projects/folder-view";
import { ProjectDetailsModal } from "@/components/features/projects/project-details-modal";
import { ClientDetailsModal } from "@/components/features/clients/client-details-modal";
import { Can } from "@/components/features/auth/can";

export default function ProjectsPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<any>(null);
  const [clientToView, setClientToView] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"list" | "folder">("list");
  const [sortBy, setSortBy] = useState<string>("createdAt_desc");
  const [groupByKey, setGroupByKey] = useState<string>("createdAt");
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");

  const { data: orgSettings } = useQuery({
    queryKey: ["orgSettings"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/settings`, { credentials: "include" });
      if (!res.ok) return { metadata: {} };
      return res.json();
    },
  });

  const { data: rawCustomFields, isLoading: fieldsLoading } = useQuery({
    queryKey: ["custom-fields", "project"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/custom-fields?entityType=project`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch custom fields");
      return res.json();
    },
  });

  const customFields = useMemo(() => {
    if (!rawCustomFields) return [];
    const allowedColumns = orgSettings?.metadata?.clientFileViewColumns;
    if (Array.isArray(allowedColumns) && allowedColumns.length > 0) {
      return rawCustomFields.filter((cf: any) => allowedColumns.includes(cf.id));
    }
    // If no columns are explicitly allowed/configured, we show all of them.
    return rawCustomFields;
  }, [rawCustomFields, orgSettings]);

  // Default to Arrival Date if it exists
  useEffect(() => {
    if (customFields) {
      const arrivalField = customFields.find((f: any) => f.fieldName.toLowerCase().includes("arrival"));
      if (arrivalField) {
        setGroupByKey(arrivalField.fieldKey);
        setSortBy(`${arrivalField.fieldKey}_desc`);
      }
    }
  }, [customFields]);

  const { data: projects, isLoading: projectsLoading, refetch } = useQuery({
    queryKey: ["projects", activeTab],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/projects?status=${activeTab}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
  });

  const sortedProjects = useMemo(() => {
    if (!projects) return [];
    
    const [sortField, sortOrder] = sortBy.split("_");
    
    return [...projects].sort((a: any, b: any) => {
      let valA, valB;

      if (sortField === "createdAt") {
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      } else if (sortField === "archivedAt") {
        valA = a.archivedAt ? new Date(a.archivedAt).getTime() : 0;
        valB = b.archivedAt ? new Date(b.archivedAt).getTime() : 0;
      } else if (sortField === "name") {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else {
        // Custom field sort
        valA = a.customFields?.[sortField] || "";
        valB = b.customFields?.[sortField] || "";
        
        // Try parsing dates if possible for custom fields
        const dateA = new Date(valA);
        const dateB = new Date(valB);
        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          valA = dateA.getTime();
          valB = dateB.getTime();
        }
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [projects, sortBy]);

  // Extract date custom fields for grouping dropdown
  const dateFields = useMemo(() => {
    if (!customFields) return [];
    return customFields.filter((cf: any) => cf.fieldType === "date");
  }, [customFields]);

  const handleEdit = (project: any) => {
    setProjectToEdit(project);
    setIsAddModalOpen(true);
  };

  const handleArchiveToggle = async (project: any) => {
    const isArchived = project.status === "archived";
    const endpoint = isArchived ? "unarchive" : "archive";
    try {
      const res = await fetch(`${apiUrl}/api/workspaces/projects/${project.id}/${endpoint}`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Failed to ${endpoint} file`);
      toast.success(`File successfully ${isArchived ? "unarchived" : "archived"}`);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (project: any) => {
    if (!confirm(`Are you sure you want to delete ${project.name}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${apiUrl}/api/workspaces/projects/${project.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete file");
      toast.success("File deleted successfully");
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const [projectToView, setProjectToView] = useState<any>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Files Dashboard</h1>
          <p className="text-muted-foreground text-sm">Manage, sort, and organize your files.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => { setProjectToEdit(null); setIsAddModalOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add File
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-[200px] grid-cols-2 mb-4">
          <TabsTrigger value="active">Active</TabsTrigger>
          <Can I="file:view_archived">
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </Can>
        </TabsList>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/30 p-2 rounded-lg border mb-4">
          <ToggleGroup type="single" value={viewMode} onValueChange={(val) => val && setViewMode(val as "list" | "folder")}>
            <ToggleGroupItem value="list" aria-label="Toggle list view">
              <List className="h-4 w-4 mr-2" /> List
            </ToggleGroupItem>
            <ToggleGroupItem value="folder" aria-label="Toggle folder view">
              <FolderTree className="h-4 w-4 mr-2" /> Folder
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {viewMode === "folder" ? (
               <div className="flex items-center gap-2 text-sm">
                 <span className="text-muted-foreground whitespace-nowrap">Group by:</span>
                 <Select value={groupByKey} onValueChange={setGroupByKey}>
                   <SelectTrigger className="w-[180px] bg-background">
                     <SelectValue placeholder="Group by..." />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="createdAt">Created Date</SelectItem>
                     {dateFields.map((df: any) => (
                       <SelectItem key={df.id} value={df.fieldKey}>{df.fieldName}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                 <span className="text-muted-foreground whitespace-nowrap">Sort by:</span>
                 <Select value={sortBy} onValueChange={setSortBy}>
                   <SelectTrigger className="w-[200px] bg-background">
                     <SelectValue placeholder="Sort by..." />
                   </SelectTrigger>
                   <SelectContent>
                     {activeTab === "archived" && (
                       <>
                         <SelectItem value="archivedAt_desc">Archived At (Newest)</SelectItem>
                         <SelectItem value="archivedAt_asc">Archived At (Oldest)</SelectItem>
                       </>
                     )}
                     <SelectItem value="createdAt_desc">Created (Newest)</SelectItem>
                     <SelectItem value="createdAt_asc">Created (Oldest)</SelectItem>
                     <SelectItem value="name_asc">Name (A-Z)</SelectItem>
                     <SelectItem value="name_desc">Name (Z-A)</SelectItem>
                     {customFields?.map((cf: any) => (
                       <div key={cf.id}>
                          <SelectItem value={`${cf.fieldKey}_asc`}>{cf.fieldName} (Asc)</SelectItem>
                          <SelectItem value={`${cf.fieldKey}_desc`}>{cf.fieldName} (Desc)</SelectItem>
                       </div>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
            )}
          </div>
        </div>

        <TabsContent value="active" className="m-0 border-none p-0 outline-none">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {viewMode === "list" ? (
              <ListView 
                projects={sortedProjects} 
                customFields={customFields || []} 
                isLoading={projectsLoading} 
                onEdit={handleEdit}
                onDelete={handleDelete}
                onView={setProjectToView}
                onArchiveToggle={handleArchiveToggle}
                onViewClient={setClientToView}
                isArchivedView={false}
                visibleColumns={orgSettings?.metadata?.clientFileViewColumns}
              />
            ) : (
              <FolderView 
                projects={sortedProjects} 
                customFields={customFields || []} 
                groupByKey={groupByKey} 
                onEdit={handleEdit}
                onDelete={handleDelete}
                onView={setProjectToView}
                onArchiveToggle={handleArchiveToggle}
                onViewClient={setClientToView}
                isArchivedView={false}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="archived" className="m-0 border-none p-0 outline-none">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {viewMode === "list" ? (
              <ListView 
                projects={sortedProjects} 
                customFields={customFields || []} 
                isLoading={projectsLoading} 
                onEdit={handleEdit}
                onDelete={handleDelete}
                onView={setProjectToView}
                onArchiveToggle={handleArchiveToggle}
                onViewClient={setClientToView}
                showArchivedAt={true}
                isArchivedView={true}
                visibleColumns={orgSettings?.metadata?.clientFileViewColumns}
              />
            ) : (
              <FolderView 
                projects={sortedProjects} 
                customFields={customFields || []} 
                groupByKey={groupByKey} 
                onEdit={handleEdit}
                onDelete={handleDelete}
                onView={setProjectToView}
                onArchiveToggle={handleArchiveToggle}
                onViewClient={setClientToView}
                showArchivedAt={true}
                isArchivedView={true}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AddProjectModal 
        isOpen={isAddModalOpen} 
        onClose={() => {
          setIsAddModalOpen(false);
          setProjectToEdit(null);
        }} 
        editProject={projectToEdit}
      />
      <ProjectDetailsModal
        project={projectToView}
        onClose={() => setProjectToView(null)}
      />
      <ClientDetailsModal
        client={clientToView}
        onClose={() => setClientToView(null)}
      />
    </div>
  );
}
