import { notFound } from "next/navigation";
import { UserDetail } from "@/components/admin/UserDetail";
import { requirePagePermission } from "@/lib/auth/dal";
import { getAdminUser, getUserOverrides } from "@/lib/auth/adminUsers";
import type { Scope } from "@/lib/auth/permissions";
import { loadRoleMatrix } from "@/lib/auth/roleMatrix";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user: me } = await requirePagePermission("users", "view");
  const { id } = await params;

  const user = await getAdminUser(id);
  if (!user) notFound();

  const [overrides, roleDefaults, owners] = await Promise.all([
    getUserOverrides(id),
    loadRoleMatrix(),
    prisma.owner.findMany({ include: { user: { select: { name: true } } }, orderBy: { name: "asc" } }),
  ]);

  return (
    <UserDetail
      initialUser={user}
      initialOverrides={overrides as Record<string, Scope>}
      roleDefaults={roleDefaults}
      owners={owners.map((o) => ({ id: o.id, name: o.name, userId: o.userId, userName: o.user?.name ?? null }))}
      isSelf={me.id === user.id}
    />
  );
}
