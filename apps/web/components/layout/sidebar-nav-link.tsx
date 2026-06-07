"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { LucideIcon } from "lucide-react";

interface SidebarNavLinkProps {
  href: string;
  name: string;
  icon: LucideIcon;
  activeVariant?: "primary" | "muted";
  activeMatch?: string;
  isCollapsed?: boolean;
  showTooltip?: boolean;
  hideLabelOnMobile?: boolean;
  className?: string;
  onClick?: () => void;
}

export function SidebarNavLink({
  href,
  name,
  icon: Icon,
  activeVariant = "primary",
  activeMatch,
  isCollapsed = false,
  showTooltip = true,
  hideLabelOnMobile = false,
  className,
  onClick,
}: SidebarNavLinkProps) {
  const pathname = usePathname();
  const isActive = activeMatch
    ? pathname.startsWith(activeMatch)
    : (() => {
        const isRootPath = ["/dashboard", "/admin", "/super-admin", "/org-admin"].includes(href);
        return isRootPath ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
      })();

  const activeStyles = {
    primary: "bg-muted text-foreground font-medium",
    muted: "bg-muted text-foreground font-medium",
  };

  const linkContent = (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center h-10 rounded-lg text-sm transition-colors duration-200 outline-none focus-visible:bg-muted/70 px-3",
        // Only apply full width if we aren't hiding the label on mobile
        hideLabelOnMobile && !isCollapsed ? "w-auto md:w-full" : "w-full",
        isActive ? activeStyles[activeVariant] : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        className
      )}
    >
      <Icon className="h-5 w-5 md:h-4 md:w-4 shrink-0" />

      <div
        className={cn(
          "overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out",
          isCollapsed ? "max-w-0 opacity-0 ml-0 pointer-events-none" : "max-w-[160px] opacity-100 ml-3",
          hideLabelOnMobile && !isCollapsed && "hidden md:block"
        )}
      >
        <span className="block truncate">{name}</span>
      </div>
    </Link>
  );

  if (showTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        {isCollapsed && (
          <TooltipContent side="right" sideOffset={8}>
            {name}
          </TooltipContent>
        )}
      </Tooltip>
    );
  }

  return linkContent;
}
