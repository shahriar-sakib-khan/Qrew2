import { pgTable, text, timestamp, boolean, primaryKey, unique } from "drizzle-orm/pg-core";
import { users, organizations, members } from "./auth";

// 1. The Global Registry (Seeded by Developers, Read-Only for Users)
export const permissions = pgTable("permissions", {
  key: text("key").primaryKey(), // e.g., 'finance:approve_funds'
  description: text("description").notNull(),
  category: text("category").notNull(), // e.g., 'Financials', 'Staff Management'
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// 2. Tenant Custom Roles (e.g., "Shift Manager")
export const orgRoles = pgTable("org_roles", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false).notNull(), // True for default 'Owner' role
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}, (table) => [
  unique("org_roles_org_id_name_unique").on(table.organizationId, table.name)
]);

// 3. The Role-to-Permission Binding
export const orgRolePermissions = pgTable("org_role_permissions", {
  roleId: text("role_id")
    .notNull()
    .references(() => orgRoles.id, { onDelete: "cascade" }),
  // ON DELETE RESTRICT: You cannot delete a developer permission if a role is actively using it.
  permissionKey: text("permission_key")
    .notNull()
    .references(() => permissions.key, { onDelete: "restrict" }),
}, (table) => [
  primaryKey({ columns: [table.roleId, table.permissionKey] })
]);

// 4. The Member-to-Role Binding (Many-to-Many)
export const orgMemberRoles = pgTable("org_member_roles", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  roleId: text("role_id")
    .notNull()
    .references(() => orgRoles.id, { onDelete: "restrict" }),
  assignedBy: text("assigned_by").notNull().references(() => users.id),
  assignedAt: timestamp("assigned_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  // A member cannot have the exact same role assigned twice in the same org
  unique("org_member_roles_unique").on(table.organizationId, table.memberId, table.roleId)
]);

// 5. Individual Overrides (Discord-Style Deny/Allow)
export const orgMemberPermissions = pgTable("org_member_permissions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  permissionKey: text("permission_key")
    .notNull()
    .references(() => permissions.key, { onDelete: "restrict" }),
  granted: boolean("granted").notNull(), // TRUE = Allow Override, FALSE = Deny Override
  grantedBy: text("granted_by").notNull().references(() => users.id),
  grantedAt: timestamp("granted_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => [
  unique("org_member_permissions_unique").on(table.organizationId, table.memberId, table.permissionKey)
]);
