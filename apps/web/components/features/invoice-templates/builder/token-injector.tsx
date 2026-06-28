"use client";

import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export function TokenInjector({ onSelectToken }: { onSelectToken: (token: string) => void }) {
  const { data: tokens, isLoading } = useQuery({
    queryKey: ["invoice-tokens"],
    queryFn: async () => {
      const res = await fetch(`${apiUrl}/api/invoices/tokens`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tokens");
      return res.json();
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs px-2 gap-1" disabled={isLoading}>
          <Plus className="h-3 w-3" />
          Insert Token
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto">
        <DropdownMenuLabel>Organization Constants</DropdownMenuLabel>
        <DropdownMenuGroup>
          {tokens?.organizationTokens?.length === 0 && (
            <div className="px-2 py-1 text-xs text-muted-foreground">No constants defined</div>
          )}
          {tokens?.organizationTokens?.map((t: string) => (
            <DropdownMenuItem key={t} onSelect={() => onSelectToken(t)} className="flex items-center justify-between cursor-pointer">
              <span className="font-mono text-xs">{t}</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0">ORG</Badge>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuLabel>Expense Categories</DropdownMenuLabel>
        <DropdownMenuGroup>
          {tokens?.categoryTokens?.length === 0 && (
            <div className="px-2 py-1 text-xs text-muted-foreground">No categories defined</div>
          )}
          {tokens?.categoryTokens?.map((t: string) => (
            <DropdownMenuItem key={t} onSelect={() => onSelectToken(t)} className="flex items-center justify-between cursor-pointer">
              <span className="font-mono text-xs">{t}</span>
              <Badge variant="secondary" className="text-[9px] px-1 py-0">CAT</Badge>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
