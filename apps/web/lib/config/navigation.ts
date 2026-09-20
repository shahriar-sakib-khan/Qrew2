import {
  FileText, Home, Receipt, Settings, Users, Wallet, Shield, ShieldAlert, ShieldCheck, Contact,
  LayoutDashboard, ArrowLeft
} from "lucide-react";

export const NAV_CONFIG = {
  user: [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Clients", href: "/dashboard/clients", icon: Contact },
    { name: "Files", href: "/dashboard/projects", icon: FileText },
    { name: "Financials", href: "/dashboard/financials", icon: Wallet },
    { name: "Staffs", href: "/dashboard/staffs", icon: Users },
    { name: "Invoices", href: "/dashboard/invoices", icon: Receipt },
  ],
  admin: [
    { name: "Admin Home", href: "/admin", icon: Shield },
    { name: "Manage Users", href: "/admin/users", icon: Users },
  ],
  superAdmin: [
    { name: "System Core", href: "/super-admin", icon: ShieldAlert },
    { name: "Manage Admins", href: "/super-admin/admins", icon: ShieldCheck },
  ],
  userSettings: { name: "Settings", href: "/dashboard/settings/profile", icon: Settings },
  adminSettings: { name: "Settings", href: "/admin/settings/profile", icon: Settings },
  superAdminSettings: { name: "System Settings", href: "/super-admin/settings/profile", icon: Settings },
  
  tenantAdmin: [
    { name: "Overview", href: "/org-admin", icon: LayoutDashboard },
    { name: "Staff Management", href: "/org-admin/staff", icon: Users },
    { name: "Roles & Permissions", href: "/org-admin/roles", icon: Shield },
    { name: "Customize Fields", href: "/org-admin/customize-fields", icon: Settings },
    { name: "Invoice Templates", href: "/org-admin/invoice-templates", icon: FileText },
  ],
  tenantAdminExit: {
    name: "Back to Dashboard",
    href: "/dashboard",
    icon: ArrowLeft,
  }
};
