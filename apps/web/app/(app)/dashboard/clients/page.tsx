"use client";

import { Button } from "@/components/ui/button";
import { Plus, ArchiveRestore, ArchiveX, Edit, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
import { AddClientModal } from "@/components/features/clients/add-client-modal";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Can } from "@/components/features/auth/can";
import { toast } from "sonner";
import { ClientDetailsModal } from "@/components/features/clients/client-details-modal";

export default function ClientsPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<any>(null);
  const [clientToView, setClientToView] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("active");

  const { data: orgSettings } = useQuery({
    queryKey: ["orgSettings"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/settings`, { credentials: "include" });
      if (!res.ok) return { metadata: {} };
      return res.json();
    },
  });

  const { data: rawCustomFields, isLoading: customFieldsLoading } = useQuery({
    queryKey: ["custom-fields", "client"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/custom-fields?entityType=client`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch custom fields");
      return res.json();
    },
  });

  const customFields = useMemo(() => {
    if (!rawCustomFields) return [];
    const allowedColumns = orgSettings?.metadata?.clientViewColumns;
    if (Array.isArray(allowedColumns) && allowedColumns.length > 0) {
      return rawCustomFields.filter((cf: any) => allowedColumns.includes(cf.id));
    }
    return rawCustomFields;
  }, [rawCustomFields, orgSettings]);

  const { data: clients, isLoading: clientsLoading, refetch } = useQuery({
    queryKey: ["clients", activeTab],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/clients?status=${activeTab === 'archived' ? 'archived' : 'active'}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  const handleDelete = async (client: any) => {
    if (!confirm(`Are you sure you want to permanently delete ${client.name}? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`${apiUrl}/api/workspaces/clients/${client.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Client deleted permanently");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete client");
    }
  };

  const handleArchive = async (client: any) => {
    if (!confirm(`Archive ${client.name}?`)) return;
    try {
      const res = await fetch(`${apiUrl}/api/workspaces/clients/${client.id}/archive`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Client archived");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to archive client");
    }
  };

  const handleUnarchive = async (client: any) => {
    try {
      const res = await fetch(`${apiUrl}/api/workspaces/clients/${client.id}/unarchive`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Client unarchived");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to unarchive client");
    }
  };

  const handleEdit = (client: any) => {
    setClientToEdit(client);
    setIsAddModalOpen(true);
  };

  const showCol = (key: string) => {
    const visibleColumns = orgSettings?.metadata?.clientViewColumns;
    return !visibleColumns || visibleColumns.includes(key);
  };

  const renderClientsTable = (isArchivedView: boolean) => (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {showCol('sys-client-name') && <TableHead className="w-[200px]">Name</TableHead>}
            {showCol('sys-client-email') && <TableHead>Email</TableHead>}
            {customFields?.map((field: any) => (
              <TableHead key={field.id}>{field.fieldName}</TableHead>
            ))}
            <TableHead className="w-[120px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientsLoading || customFieldsLoading ? (
            <TableRow>
              <TableCell 
                colSpan={1 + (showCol('sys-client-name') ? 1 : 0) + (showCol('sys-client-email') ? 1 : 0) + (customFields?.length || 0)} 
                className="h-24 text-center text-muted-foreground"
              >
                Loading clients...
              </TableCell>
            </TableRow>
          ) : clients?.length === 0 ? (
            <TableRow>
              <TableCell 
                colSpan={1 + (showCol('sys-client-name') ? 1 : 0) + (showCol('sys-client-email') ? 1 : 0) + (customFields?.length || 0)} 
                className="h-24 text-center text-muted-foreground"
              >
                No {isArchivedView ? "archived" : "active"} clients found.
              </TableCell>
            </TableRow>
          ) : (
            clients?.map((client: any) => (
              <TableRow 
                key={client.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setClientToView(client)}
              >
                {showCol('sys-client-name') && (
                  <TableCell className="font-medium">
                    {client.name}
                  </TableCell>
                )}
                {showCol('sys-client-email') && (
                  <TableCell>
                    {client.email || "-"}
                  </TableCell>
                )}
                {customFields?.map((field: any) => (
                  <TableCell key={field.id}>
                    {client.customFields?.[field.fieldKey] || "-"}
                  </TableCell>
                ))}
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    {!isArchivedView ? (
                      <>
                        <Can I="client:edit">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEdit(client)} title="Edit Client">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Can>
                        <Can I="client:edit">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-orange-500" onClick={() => handleArchive(client)} title="Archive Client">
                            <ArchiveX className="h-4 w-4" />
                          </Button>
                        </Can>
                      </>
                    ) : (
                      <>
                        <Can I="client:edit">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-green-500" onClick={() => handleUnarchive(client)} title="Unarchive Client">
                            <ArchiveRestore className="h-4 w-4" />
                          </Button>
                        </Can>
                        <Can I="client:delete">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(client)} title="Permanently Delete Client">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </Can>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Client Directory</h1>
        <Button onClick={() => { setClientToEdit(null); setIsAddModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="active">Active Clients</TabsTrigger>
          <Can I="client:view_archived">
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </Can>
        </TabsList>
        <TabsContent value="active">
          {renderClientsTable(false)}
        </TabsContent>
        <TabsContent value="archived">
          {renderClientsTable(true)}
        </TabsContent>
      </Tabs>

      <AddClientModal 
        isOpen={isAddModalOpen} 
        onClose={() => {
          setIsAddModalOpen(false);
          setClientToEdit(null);
        }} 
        editClient={clientToEdit}
      />
      
      <ClientDetailsModal
        client={clientToView}
        mode="full"
        onClose={() => setClientToView(null)}
        onEdit={(client) => {
          setClientToView(null);
          handleEdit(client);
        }}
      />
    </div>
  );
}
