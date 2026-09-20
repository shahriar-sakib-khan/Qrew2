import { useState } from "react";
import { TriangleAlert, Edit2, Trash2, Plus, MoreHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UnresolvedNoticeButton({ notices }: { notices: any[] }) {
  const [open, setOpen] = useState(false);
  if (!notices?.length) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 transition-colors shrink-0"
          title="Validation Warnings"
        >
          <TriangleAlert className="w-2.5 h-2.5 text-amber-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-3 border-amber-500/30 shadow-xl z-[100]">
        <div className="flex items-start gap-2">
          <TriangleAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-300 mb-1">Warnings</p>
            <ul className="space-y-1">
              {notices.map((n: any, i: number) => (
                <li key={i} className="text-[11px] font-mono bg-muted/40 rounded px-2 py-1 flex flex-col gap-1">
                  {n.token && <span className="text-amber-300">{n.token}</span>}
                  {n.message && <span className="text-muted-foreground break-words whitespace-pre-wrap">{n.message}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function RowActions({
  onEdit,
  onDelete,
  onAddCharge,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onAddCharge?: () => void;
}) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        onClick={onEdit}
        title="Edit Token"
      >
        <Edit2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        title="Delete Row"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      {onAddCharge && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={onAddCharge}
          title="Add a Charge"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add charge
        </Button>
      )}
    </>
  );
}

export function MobileRowActions({
  onEdit,
  onDelete,
  onAddCharge,
  isCharge = false,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  onAddCharge?: () => void;
  isCharge?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:bg-muted/50">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 z-[100]">
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Edit2 className="h-4 w-4 mr-2 text-muted-foreground" /> {isCharge ? "Edit charge" : "Edit row"}
          </DropdownMenuItem>
        )}
        {onAddCharge && (
          <DropdownMenuItem onClick={onAddCharge}>
            <Plus className="h-4 w-4 mr-2 text-muted-foreground" /> Add charge
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive focus:bg-destructive/10">
            <Trash2 className="h-4 w-4 mr-2" /> {isCharge ? "Delete charge" : "Delete row"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
