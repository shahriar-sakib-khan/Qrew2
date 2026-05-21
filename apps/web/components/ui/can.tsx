"use client";

import { ReactNode } from "react";
import { usePermissionStore } from "@/store/use-permission-store";

interface CanProps {
  I: string; // The permission key (e.g., 'staff:provision')
  children: ReactNode;
  fallback?: ReactNode; // Optional UI to show if they DON'T have permission
}

export function Can({ I, children, fallback = null }: CanProps) {
  const { can, isLoaded } = usePermissionStore();

  // Prevent UI flashing: Render nothing while permissions are loading over the network
  if (!isLoaded) return null; 

  if (can(I)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
