import "server-only";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/auth/permissions";

export type AdminUserDto = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  owners: { id: string; name: string }[];
  overrideCount: number;
};

type UserWithRelations = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  owners: { id: string; name: string }[];
  _count: { permissions: number };
};

export function toAdminUserDto(u: UserWithRelations): AdminUserDto {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: ((ROLES as readonly string[]).includes(u.role) ? u.role : "VIEWER") as Role,
    active: u.active,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    owners: u.owners,
    overrideCount: u._count.permissions,
  };
}

export const ADMIN_USER_INCLUDE = {
  owners: { select: { id: true, name: true }, orderBy: { name: "asc" } },
  _count: { select: { permissions: true } },
} as const;

export async function listAdminUsers(): Promise<AdminUserDto[]> {
  const rows = await prisma.user.findMany({
    include: ADMIN_USER_INCLUDE,
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return rows.map(toAdminUserDto);
}

export async function getAdminUser(id: string): Promise<AdminUserDto | null> {
  const row = await prisma.user.findUnique({ where: { id }, include: ADMIN_USER_INCLUDE });
  return row ? toAdminUserDto(row) : null;
}

/** Raw per-user override rows as a "resource:action" → scope map. */
export async function getUserOverrides(userId: string): Promise<Record<string, string>> {
  const rows = await prisma.userPermission.findMany({ where: { userId } });
  return Object.fromEntries(rows.map((r) => [`${r.resource}:${r.action}`, r.scope]));
}
