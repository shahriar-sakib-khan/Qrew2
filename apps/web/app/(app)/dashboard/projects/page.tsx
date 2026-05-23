"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { AddProjectModal } from "@/components/features/projects/add-project-modal";
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

export default function ProjectsPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { data: customFields, isLoading } = useQuery({
    queryKey: ["custom-fields", "project"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/workspaces/custom-fields?entityType=project`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch custom fields");
      return res.json();
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Files Dashboard</h1>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add File
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Name</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              {customFields?.map((field: any) => (
                <TableHead key={field.id}>{field.fieldName}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell 
                colSpan={3 + (customFields?.length || 0)} 
                className="h-24 text-center text-muted-foreground"
              >
                No files found.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <AddProjectModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </div>
  );
}
