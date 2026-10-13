import "server-only";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ROLE_MATRIX,
  ROLES,
  resolvePermissions,
  type PermissionRow,
  type PermissionSet,
  type Role,
  type Scope,
} from "@/lib/auth/permissions";

/** Effective permissions per role: built-in defaults plus any admin edits stored in RolePermission. */
export async function loadRoleMatrix(): Promise<Record<Role, PermissionSet>> {
  const dbRows = await prisma.rolePermission.findMany();
  const out = {} as Record<Role, PermissionSet>;
  for (const role of ROLES) {
    const rows: PermissionRow[] = dbRows
      .filter((r) => r.role === role)
      .map((r) => ({ resource: r.resource, action: r.action, scope: r.scope as Scope }));
    out[role] = resolvePermissions(role, DEFAULT_ROLE_MATRIX[role], [], rows);
  }
  return out;
}
