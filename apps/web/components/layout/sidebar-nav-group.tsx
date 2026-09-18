"use client";

/**
 * sidebar-nav-group.tsx
 * A collapsible group for the sidebar that renders a parent item with children.
 * Auto-expands when the active pathname is inside the group's base href.
 *
 * WHY a separate component instead of extending SidebarNavLink:
 * A group has fundamentally different behavior — it's a button (not a link),
 * manages open/close state, and renders a nested list. Keeping it separate
 * keeps SidebarNavLink simple and single-purpose.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface NavChild {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface SidebarNavGroupProps {
  name: string;
  icon: LucideIcon;
  baseHref: string;          // e.g. "/dashboard/inventory" — used to detect active group
  children: NavChild[];
  isCollapsed?: boolean;
  activeVariant?: "primary" | "muted";
}

export function SidebarNavGroup({
  name,
  icon: Icon,
  baseHref,
  children,
  isCollapsed = false,
  activeVariant = "primary",
}: SidebarNavGroupProps) {
  const pathname = usePathname();

  // Group is "active" if the current path is within this group's base href.
  const isGroupActive = pathname.startsWith(baseHref);

  // Auto-open the group when a child route is active; allow manual toggle.
  const [isOpen, setIsOpen] = useState(isGroupActive);

  // Keep in sync if user navigates via browser back/forward.
  useEffect(() => {
    if (isGroupActive) setIsOpen(true);
  }, [isGroupActive]);

  // When collapsed, show only the icon + tooltip with the group name.
  if (isCollapsed) {
    return (
      <div className="flex flex-col gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={cn(
                "flex items-center justify-center h-10 w-full rounded-lg transition-colors",
                isGroupActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {name}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {/* Parent row — clicking toggles open/closed */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-3 h-10 w-full rounded-lg px-3 text-sm transition-colors duration-200 outline-none",
          isGroupActive
            ? "text-foreground font-medium"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left truncate">{name}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200 text-muted-foreground",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Children — slide in/out with max-height animation */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-in-out",
          isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="ml-3 pl-3 border-l border-border/50 flex flex-col gap-0.5 py-0.5">
          {children.map((child) => {
            // Exact match for the first child (default landing); prefix match for others.
            const isActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
            const ChildIcon = child.icon;

            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "flex items-center gap-2.5 h-9 rounded-md px-2 text-sm transition-colors duration-150 outline-none",
                  isActive
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{child.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
