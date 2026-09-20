"use client";

import { useParams } from "next/navigation";
import { RoleBuilder } from "@/components/features/roles/role-builder";

export default function EditRolePage() {
  const params = useParams();
  return <RoleBuilder roleId={params.id as string} />;
}
