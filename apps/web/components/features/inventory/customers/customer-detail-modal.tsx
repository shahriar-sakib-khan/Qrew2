"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Can } from "@/components/features/auth/can";
import { Edit, User, Phone, Mail, MapPin, Calendar, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customer: any;
  onEdit?: (customer: any) => void;
}

export function CustomerDetailModal({ isOpen, onClose, customer, onEdit }: Props) {
  if (!customer) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b flex flex-row items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-xl font-bold">{customer.name}</DialogTitle>
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Active Buyer
              </Badge>
            </div>
            <DialogDescription className="text-xs mt-1 text-muted-foreground">
              Inventory Customer Directory Profile
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="p-6 space-y-4 bg-card">
          <div className="rounded-lg border p-4 bg-muted/20 space-y-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-primary" /> Contact Details
            </p>

            <div className="grid grid-cols-1 gap-2.5 text-sm pt-1">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground text-xs w-16">Phone:</span>
                <span className="font-medium font-mono">{customer.phone || "—"}</span>
              </div>

              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground text-xs w-16">Email:</span>
                <span className="font-medium">{customer.email || "—"}</span>
              </div>

              <div className="flex items-start gap-2 pt-1 border-t">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-muted-foreground text-xs w-16">Address:</span>
                <span className="font-medium text-xs leading-relaxed flex-1">{customer.address || "—"}</span>
              </div>
            </div>
          </div>

          {customer.createdAt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 px-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>Registered on {format(new Date(customer.createdAt), "dd MMM yyyy")}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t flex justify-end gap-2 bg-muted/20">
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          {onEdit && (
            <Can I="inventory:edit_customer">
              <Button size="sm" onClick={() => { onClose(); onEdit(customer); }} className="gap-1.5">
                <Edit className="h-4 w-4" /> Edit Customer
              </Button>
            </Can>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
