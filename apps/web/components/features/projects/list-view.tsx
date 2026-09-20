"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Edit, Archive, ArchiveRestore, Trash2, FileText } from "lucide-react";
import { useRouter } from "next/navigation";

import { Can } from "@/components/features/auth/can";

interface ListViewProps {
  projects: any[];
  customFields: any[];
  isLoading: boolean;
  onEdit?: (project: any) => void;
  onDelete?: (project: any) => void;
  onView?: (project: any) => void;
  onArchiveToggle?: (project: any) => void;
  onViewClient?: (client: any) => void;
  showArchivedAt?: boolean;
  isArchivedView?: boolean;
  visibleColumns?: string[];
}

export function ListView({ 
  projects, 
  customFields, 
  isLoading, 
  onEdit, 
  onDelete,
  onView,
  onArchiveToggle,
  onViewClient,
  showArchivedAt,
  isArchivedView,
  visibleColumns
}: ListViewProps) {
  const router = useRouter();
  
  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num || 0);
  };

  const showCol = (key: string) => !visibleColumns || visibleColumns.includes(key);

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {showCol('sys-project-name') && <TableHead className="w-[250px]">Name</TableHead>}
            <TableHead>Client</TableHead>
            {showCol('sys-project-status') && <TableHead>Status</TableHead>}
            {showCol('total_expenses') && <TableHead>Total Expenses</TableHead>}
            <TableHead>Created At</TableHead>
            {showArchivedAt && <TableHead>Archived At</TableHead>}
            {customFields?.map((field: any) => (
              <TableHead key={field.id}>{field.fieldName}</TableHead>
            ))}
            <TableHead className="w-[120px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell 
                colSpan={2 + (showCol('sys-project-name') ? 1 : 0) + (showCol('sys-project-status') ? 1 : 0) + (showCol('total_expenses') ? 1 : 0) + (showArchivedAt ? 1 : 0) + (customFields?.length || 0)} 
                className="h-24 text-center text-muted-foreground"
              >
                Loading files...
              </TableCell>
            </TableRow>
          ) : projects?.length === 0 ? (
            <TableRow>
              <TableCell 
                colSpan={2 + (showCol('sys-project-name') ? 1 : 0) + (showCol('sys-project-status') ? 1 : 0) + (showCol('total_expenses') ? 1 : 0) + (showArchivedAt ? 1 : 0) + (customFields?.length || 0)} 
                className="h-24 text-center text-muted-foreground"
              >
                No files found.
              </TableCell>
            </TableRow>
          ) : (
            projects?.map((project: any) => (
              <TableRow 
                key={project.id} 
                className="hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => onView?.(project)}
              >
                {showCol('sys-project-name') && (
                  <TableCell className="font-medium text-primary hover:underline">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {project.name}
                    </div>
                  </TableCell>
                )}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {project.client ? (
                    <span 
                      className="cursor-pointer hover:underline text-primary"
                      onClick={() => onViewClient?.(project.client)}
                    >
                      {project.client.name}
                    </span>
                  ) : "-"}
                </TableCell>
                {showCol('sys-project-status') && (
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {project.status}
                    </Badge>
                  </TableCell>
                )}
                {showCol('total_expenses') && (
                  <TableCell className="font-medium">
                    {formatCurrency(project.totalExpenses)}
                  </TableCell>
                )}
                <TableCell className="text-muted-foreground">
                  {format(new Date(project.createdAt), "MMM d, yyyy")}
                </TableCell>
                {showArchivedAt && (
                  <TableCell className="text-muted-foreground">
                    {project.archivedAt ? format(new Date(project.archivedAt), "MMM d, yyyy") : "-"}
                  </TableCell>
                )}
                {customFields?.map((field: any) => {
                  const val = project.customFields?.[field.fieldKey];
                  let displayVal = val || "-";
                  
                  // Format if date
                  if (val && field.fieldType === "date") {
                     try {
                       displayVal = format(new Date(val), "MMM d, yyyy");
                     } catch(e) {}
                  }

                  return (
                    <TableCell key={field.id}>
                      {displayVal}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    {!isArchivedView ? (
                      <>
                        <Can I="projects:edit">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); onEdit?.(project); }} title="Edit File">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Can>
                        <Can I="projects:edit">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-orange-500" onClick={(e) => { e.stopPropagation(); onArchiveToggle?.(project); }} title="Archive File">
                            <Archive className="h-4 w-4" />
                          </Button>
                        </Can>
                      </>
                    ) : (
                      <>
                        <Can I="projects:edit">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-green-500" onClick={(e) => { e.stopPropagation(); onArchiveToggle?.(project); }} title="Unarchive File">
                            <ArchiveRestore className="h-4 w-4" />
                          </Button>
                        </Can>
                        <Can I="projects:delete">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete?.(project); }} title="Permanently Delete File">
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
}
