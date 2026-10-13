import "server-only";
import { prisma } from "@/lib/prisma";
import { accessesForAction } from "@/lib/auth/membership";
import type { Scope } from "@/lib/auth/permissions";
import { ALL_ACCESS, NO_ACCESS, normalizeOwnerNames, type AccessScope } from "@/lib/auth/scope";

/**
 * Resolves a permission scope into a concrete AccessScope for one user + action.
 * OWN covers: owner names an admin linked to the user, the user's own name, and items they are a
 * team member of (any role to view; Owner or Contributor to change; Owner only to delete).
 */
export async function loadAccessScope(
  user: { id: string; name: string },
  scope: Scope,
  action: string,
): Promise<AccessScope> {
  if (scope === "ALL") return ALL_ACCESS;
  if (scope === "NONE") return NO_ACCESS;

  const [owners, shares] = await Promise.all([
    prisma.owner.findMany({ where: { userId: user.id }, select: { name: true } }),
    prisma.itemShare.findMany({
      where: { userId: user.id, access: { in: accessesForAction(action) } },
      select: { entityType: true, entityId: true },
    }),
  ]);

  return {
    all: false,
    ownerNames: normalizeOwnerNames([user.name, ...owners.map((o) => o.name)]),
    sharedProjectIds: shares.filter((s) => s.entityType === "PROJECT").map((s) => s.entityId),
    sharedIdeaIds: shares.filter((s) => s.entityType === "IDEA").map((s) => s.entityId),
  };
}
