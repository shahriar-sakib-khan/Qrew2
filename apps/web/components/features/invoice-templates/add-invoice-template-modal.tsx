"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X, Edit2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/constants";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AddEditInvoiceTemplateModal({ 
  isOpen, 
  onClose,
  editTemplate,
}: { 
  isOpen: boolean; 
  onClose: () => void;
  editTemplate?: any;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  
  const [prefix, setPrefix] = useState("INV");
  const [isPrefixDirty, setIsPrefixDirty] = useState(false);

  // Format Builder State
  const [dynamicBlocks, setDynamicBlocks] = useState<Array<{type: 'year'|'month'|'day', format: string}>>([
    { type: 'year', format: 'YYYY' }
  ]);
  const [seqPadding, setSeqPadding] = useState(3);

  // Pre-fill on open if editing
  useEffect(() => {
    if (isOpen) {
      if (editTemplate) {
        setName(editTemplate.name || "");
        setDescription(editTemplate.description || "");
        setPrefix(editTemplate.documentPrefix || "INV");
        setIsPrefixDirty(true);
        
        const format = editTemplate.numberingFormat || "{PREFIX}-{YYYY}-{SEQ:3}";
        const parts = format.split('-');
        const parsedBlocks = [];
        for (const part of parts) {
          if (part === '{YYYY}' || part === '{YY}') {
            parsedBlocks.push({ type: 'year', format: part.replace(/[{}]/g, '') });
          } else if (part === '{MM}' || part === '{MMM}') {
            parsedBlocks.push({ type: 'month', format: part.replace(/[{}]/g, '') });
          } else if (part === '{DD}') {
            parsedBlocks.push({ type: 'day', format: 'DD' });
          }
        }
        setDynamicBlocks(parsedBlocks as any);
        
        const seqMatch = format.match(/\{SEQ:(\d+)\}/);
        if (seqMatch) {
          setSeqPadding(parseInt(seqMatch[1], 10));
        } else {
          setSeqPadding(3);
        }
      } else {
        setName("");
        setDescription("");
        setPrefix("INV");
        setIsPrefixDirty(false);
        setDynamicBlocks([{ type: 'year', format: 'YYYY' }]);
        setSeqPadding(3);
      }
    }
  }, [isOpen, editTemplate]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isPrefixDirty) {
      setPrefix(val.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '') || "INV");
    }
  };

  const availableBlocks = ['year', 'month', 'day'].filter(
    (type) => !dynamicBlocks.find((b) => b.type === type)
  );

  const addBlock = (type: string) => {
    let defaultFormat = 'YYYY';
    if (type === 'month') defaultFormat = 'MM';
    if (type === 'day') defaultFormat = 'DD';
    setDynamicBlocks([...dynamicBlocks, { type: type as any, format: defaultFormat }]);
  };

  const removeBlock = (index: number) => {
    const newBlocks = [...dynamicBlocks];
    newBlocks.splice(index, 1);
    setDynamicBlocks(newBlocks);
  };

  const updateBlock = (index: number, format: string) => {
    const newBlocks = [...dynamicBlocks];
    newBlocks[index].format = format;
    setDynamicBlocks(newBlocks);
  };

  // Compute the raw format string
  const numberingFormat = useMemo(() => {
    const parts = ["{PREFIX}"];
    dynamicBlocks.forEach(b => parts.push(`{${b.format}}`));
    parts.push(`{SEQ:${seqPadding}}`);
    return parts.join("-");
  }, [dynamicBlocks, seqPadding]);

  // Compute live preview
  const livePreview = useMemo(() => {
    const now = new Date();
    const parts = [prefix || "INV"];
    
    dynamicBlocks.forEach(b => {
      if (b.type === 'year') {
        parts.push(b.format === "YYYY" ? now.getFullYear().toString() : now.getFullYear().toString().slice(-2));
      } else if (b.type === 'month') {
        parts.push(b.format === "MM" ? (now.getMonth() + 1).toString().padStart(2, "0") : ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][now.getMonth()]);
      } else if (b.type === 'day') {
        parts.push(now.getDate().toString().padStart(2, "0"));
      }
    });

    parts.push("1".padStart(seqPadding, "0"));
    return parts.join("-");
  }, [prefix, dynamicBlocks, seqPadding]);

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editTemplate 
        ? `${apiUrl}/api/invoice-templates/${editTemplate.id}`
        : `${apiUrl}/api/invoice-templates`;

      const res = await fetch(url, {
        method: editTemplate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create template");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(editTemplate ? "Template updated" : "Template created");
      onClose();
      queryClient.invalidateQueries({ queryKey: ["invoice-templates"] });
      if (!editTemplate) {
        router.push(`/org-admin/invoice-templates/${data.id}`);
      }
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      name,
      description,
      documentPrefix: prefix,
      numberingFormat,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{editTemplate ? "Edit Invoice Template" : "Create Invoice Template"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              placeholder="e.g. Standard PDA Template"
            />
          </div>

          <div className="space-y-2">
            <Label>Document Indexing</Label>
            
            <div className="bg-muted/30 p-3 rounded-lg border transition-all">
              <div className="mb-3 text-xs text-muted-foreground flex items-center gap-2">
                Preview: 
                <span className="font-mono font-medium text-foreground bg-background border px-1.5 py-0.5 rounded shadow-sm">
                  {livePreview}
                </span>
              </div>
               
              <div className="flex flex-wrap items-end gap-3 pt-1">
                {/* Prefix Block */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Prefix</span>
                  <Input 
                    value={prefix} 
                    onChange={e => {
                      setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''));
                      setIsPrefixDirty(true);
                    }} 
                    className="h-9 w-[120px] text-sm font-mono uppercase" 
                    placeholder="INV"
                  />
                </div>
                
                <span className="text-muted-foreground mb-2">-</span>

                {/* Dynamic Blocks */}
                {dynamicBlocks.map((block, index) => (
                  <div key={block.type} className="flex items-end gap-3">
                    <div className="flex flex-col gap-1.5 relative group">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{block.type}</span>
                      
                      <button type="button" className="absolute -top-1.5 -right-1.5 bg-background border rounded-full p-0.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity z-10" onClick={() => removeBlock(index)}>
                        <X className="h-3 w-3" />
                      </button>
                      
                      {block.type === 'day' ? (
                        <div className="h-9 w-[80px] flex items-center justify-center bg-muted/50 border rounded-md text-sm font-mono text-muted-foreground">
                          DD
                        </div>
                      ) : (
                        <Select value={block.format} onValueChange={(v) => updateBlock(index, v)}>
                          <SelectTrigger className="h-9 w-[80px] text-sm font-mono">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {block.type === 'year' ? (
                              <>
                                <SelectItem value="YYYY">YYYY</SelectItem>
                                <SelectItem value="YY">YY</SelectItem>
                              </>
                            ) : (
                              <>
                                <SelectItem value="MM">MM</SelectItem>
                                <SelectItem value="MMM">MMM</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <span className="text-muted-foreground mb-2">-</span>
                  </div>
                ))}

                {/* Add Block Menu (In Middle) */}
                {availableBlocks.length > 0 && (
                  <div className="flex items-end gap-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" className="h-9 px-3 border-dashed text-sm text-muted-foreground bg-background">
                          <Plus className="h-4 w-4 mr-1.5" /> Add
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center">
                        {availableBlocks.map(type => (
                          <DropdownMenuItem key={type} onClick={() => addBlock(type)} className="capitalize">
                            {type}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <span className="text-muted-foreground mb-2">-</span>
                  </div>
                )}

                {/* Seq Padding Block */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Padding</span>
                  <Input 
                    type="number" 
                    min={1} 
                    max={9} 
                    value={seqPadding} 
                    onChange={e => setSeqPadding(parseInt(e.target.value) || 3)} 
                    className="h-9 w-[70px] text-sm font-mono text-center" 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Used for port disbursement accounts"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
