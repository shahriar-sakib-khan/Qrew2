"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ProjectDataDisplayProps {
  project: any;
  customFields: any[];
  projectStatuses: any[];
  viewMode: "tabs" | "scrollspy";
  onEditFields?: (statusId: string) => void;
}

export function ProjectDataDisplay({ project, customFields, projectStatuses, viewMode, onEditFields }: ProjectDataDisplayProps) {
  const [activeTab, setActiveTab] = useState<string>(projectStatuses?.[0]?.id || "");

  // Organize fields by status
  const fieldsByStatus: Record<string, any[]> = {};
  projectStatuses?.forEach((s) => {
    fieldsByStatus[s.id] = customFields?.filter(f => f.projectStatusId === s.id) || [];
  });

  const renderFieldValue = (field: any) => {
    const val = project.customFields?.[field.fieldKey];
    if (val === undefined || val === null || val === "") return <span className="text-muted-foreground italic">Not set</span>;
    if (field.fieldType === "date") {
      try {
        return format(new Date(val), "MMM d, yyyy");
      } catch (e) {
        return val;
      }
    }
    if (field.fieldType === "boolean") {
      return val ? "Yes" : "No";
    }
    return val;
  };

  const renderFieldsSection = (status: any) => {
    const fields = fieldsByStatus[status.id];
    if (!fields || fields.length === 0) {
      return <div className="text-sm text-muted-foreground italic py-4">No fields configured for this stage.</div>;
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
        {fields.map(field => (
          <div key={field.id} className="border-b pb-2">
            <span className="text-muted-foreground block mb-1 text-sm font-medium">{field.fieldName}</span>
            <span className="text-sm">{renderFieldValue(field)}</span>
          </div>
        ))}
      </div>
    );
  };

  if (viewMode === "tabs") {
    return (
      <Tabs value={activeTab || projectStatuses?.[0]?.id} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full flex justify-start overflow-x-auto h-auto bg-transparent border-b rounded-none p-0">
          {projectStatuses?.map(status => (
            <TabsTrigger 
              key={status.id} 
              value={status.id}
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2"
            >
              {status.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {projectStatuses?.map(status => (
          <TabsContent key={status.id} value={status.id} className="pt-4">
            {renderFieldsSection(status)}
            {onEditFields && (
               <Button variant="outline" size="sm" onClick={() => onEditFields(status.id)} className="mt-4">
                 Edit Stage Fields
               </Button>
            )}
          </TabsContent>
        ))}
      </Tabs>
    );
  }

  // Scrollspy mode (stack them)
  return (
    <div className="space-y-8 h-[60vh] overflow-y-auto pr-4 pb-12 relative">
      {projectStatuses?.map(status => (
        <div key={status.id} id={`status-${status.id}`} className="scroll-m-6">
          <h3 className="text-lg font-bold border-b pb-2 mb-4 sticky top-0 bg-background/95 backdrop-blur z-10 flex items-center justify-between">
            {status.name}
            {onEditFields && (
               <Button variant="ghost" size="sm" onClick={() => onEditFields(status.id)}>
                 Edit
               </Button>
            )}
          </h3>
          {renderFieldsSection(status)}
        </div>
      ))}
    </div>
  );
}
