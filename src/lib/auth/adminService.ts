import { audit } from "@/lib/audit";
import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  diffAgainstDefaults,
  escalationError,
  generateTempPassword,
  sanitizeOverrides,
  sanitizeRoleRows,
  touchesAdmin,
  validateNewUser,
  wouldLoseLastAdmin,
} from "@/lib/auth/adminRules";
import {
  ADMIN_USER_INCLUDE,
  getAdminUser,
  getUserOverrides,
  listAdminUsers,
  toAdminUserDto,
  type AdminUserDto,
} from "@/lib/auth/adminUsers";
import { hashPassword } from "@/lib/auth/password";
import { getSecurityPolicy } from "@/lib/securityPolicySettings";
import { rememberPasswordHash } from "@/lib/auth/passwordHistory";
import { emailMatchesDomain } from "@/lib/emailDomain";
import { getEmailDomain } from "@/lib/emailDomainSettings";
import { ROLES, scopeFor, type PermissionSet, type Role } from "@/lib/auth/permissions";
import type { AuthUser } from "@/lib/auth/types";
import { loadRoleMatrix } from "@/lib/auth/roleMatrix";

/** A failure with an HTTP-style status so routes can map it directly and the chatbot can read the message. */
export class AdminError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

async function requireUser(id: string): Promise<AdminUserDto> {
  const user = await getAdminUser(id);
  if (!user) throw new AdminError("User not found.", 404);
  return user;
}

const RANK = { NONE: 0, OWN: 1, ALL: 2 } as const;

/** Non-admins may not touch admin accounts. */
function guardTarget(actor: AuthUser, target: AdminUserDto) {
  if (touchesAdmin(actor, target.role)) throw new AdminError("Only admins can change admin accounts.", 403);
}

/** Creates a user. Without a password a temporary one is generated and returned as `generatedPassword`. */
export async function createUser(
  input: unknown,
  actor: AuthUser,
): Promise<{ user: AdminUserDto; generatedPassword: string | null }> {
  const parsed = validateNewUser(input, await getSecurityPolicy());
  if (!parsed.ok) throw new AdminError(parsed.error, 400);
  const { email, name, role, password, mustChangePassword, overrides } = parsed.value;
  const domain = await getEmailDomain();
  if (!emailMatchesDomain(email, domain)) {
    throw new AdminError(`Usernames must be @${domain} addresses, since that is the domain people sign in with.`, 400);
  }
  const blocked = escalationError(actor, role, overrides, await loadRoleMatrix());
  if (blocked) throw new AdminError(blocked, 403);

  const generatedPassword = password === null ? generateTempPassword() : null;
  const passwordHash = await hashPassword(password ?? (generatedPassword as string));

  try {
    const userId = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, name, role, passwordHash, mustChangePassword },
        select: { id: true },
      });
      if (overrides.length > 0) {
        await tx.userPermission.createMany({
          data: overrides.map((o) => ({ userId: created.id, resource: o.resource, action: o.action, scope: o.scope })),
        });
      }
      return created.id;
    });
    const row = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: ADMIN_USER_INCLUDE });
    await audit({
      action: "user.created",
      actorId: actor.id,
      entityType: "user",
      entityId: userId,
      meta: { name, email, role, customPermissions: overrides.length },
    });
    return { user: toAdminUserDto(row), generatedPassword };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AdminError("A user with that username already exists.", 409);
    }
    throw error;
  }
}

/** Updates name, role or active status. Refuses changes that would leave the app without an active admin. */
export async function updateUser(id: string, raw: unknown, actor: AuthUser): Promise<AdminUserDto> {
  const body = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const change: { name?: string; role?: string; active?: boolean } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) throw new AdminError("Name is required.");
    change.name = body.name.trim();
  }
  if (body.role !== undefined) {
    if (typeof body.role !== "string" || !(ROLES as readonly string[]).includes(body.role)) {
      throw new AdminError("Choose a valid role: ADMIN, MANAGER, MEMBER or VIEWER.");
    }
    change.role = body.role;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") throw new AdminError("active must be true or false.");
    change.active = body.active;
  }
  if (Object.keys(change).length === 0) throw new AdminError("Nothing to update.");

  guardTarget(actor, await requireUser(id));
  if (change.role) {
    const blocked = escalationError(actor, change.role as Role, [], await loadRoleMatrix());
    if (blocked) throw new AdminError(blocked, 403);
  }
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true, active: true } });
  if (wouldLoseLastAdmin(admins, id, change)) {
    throw new AdminError("That would leave no active admin. Make another user an admin first.", 409);
  }

  const before = await requireUser(id);
  await prisma.user.update({ where: { id }, data: change });
  const after = await requireUser(id);
  await audit({
    action: "user.updated",
    actorId: actor.id,
    entityType: "user",
    entityId: id,
    meta: {
      name: after.name,
      email: after.email,
      fields: Object.keys(change),
      ...(change.role ? { role: `${before.role} → ${change.role}` } : {}),
      ...(change.active !== undefined ? { active: change.active } : {}),
    },
  });
  return after;
}

/** New temporary password (returned), forced change at next sign-in, signed out everywhere, pending reset requests closed. */
export async function resetUserPassword(id: string, actor: AuthUser): Promise<string> {
  guardTarget(actor, await requireUser(id));
  const current = await prisma.user.findUnique({ where: { id }, select: { passwordHash: true } });
  if (!current) throw new AdminError("User not found.", 404);
  const temporaryPassword = generateTempPassword();
  await prisma.$transaction([
    // The password being replaced is remembered, so the user can't simply switch back to it afterwards.
    rememberPasswordHash(id, current.passwordHash),
    prisma.user.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(temporaryPassword),
        mustChangePassword: true,
        sessionVersion: { increment: 1 },
      },
    }),
    prisma.passwordResetRequest.updateMany({
      where: { userId: id, status: "PENDING" },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: actor.id },
    }),
  ]);
  await audit({ action: "user.password_reset", actorId: actor.id, entityType: "user", entityId: id, meta: { email: (await requireUser(id)).email } });
  return temporaryPassword;
}

/** Applies per-user overrides ("resource:action" → scope, null to clear). Returns the stored overrides. */
export async function setUserOverrides(id: string, raw: unknown, actor: AuthUser): Promise<Record<string, string>> {
  const parsed = sanitizeOverrides(raw);
  if (!parsed.ok) throw new AdminError(parsed.error);

  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!user) throw new AdminError("User not found.", 404);
  if (user.role === "ADMIN") {
    throw new AdminError("Admins always have full access; change their role first.");
  }
  const blocked = escalationError(actor, user.role as Role, parsed.set, await loadRoleMatrix());
  if (blocked) throw new AdminError(blocked, 403);

  await prisma.$transaction([
    ...parsed.clear.map((c) =>
      prisma.userPermission.deleteMany({ where: { userId: id, resource: c.resource, action: c.action } }),
    ),
    ...parsed.set.map((row) =>
      prisma.userPermission.upsert({
        where: { userId_resource_action: { userId: id, resource: row.resource, action: row.action } },
        create: { userId: id, ...row },
        update: { scope: row.scope },
      }),
    ),
  ]);
  await audit({
    action: "user.permissions_changed",
    actorId: actor.id,
    entityType: "user",
    entityId: id,
    meta: { set: parsed.set.length, cleared: parsed.clear.length },
  });
  return getUserOverrides(id);
}

/** Replaces which owner names belong to a user (an owner name belongs to one user at a time). */
export async function setUserOwners(id: string, ownerIds: string[], actor: AuthUser): Promise<AdminUserDto> {
  guardTarget(actor, await requireUser(id));
  await prisma.$transaction([
    prisma.owner.updateMany({ where: { userId: id, id: { notIn: ownerIds } }, data: { userId: null } }),
    prisma.owner.updateMany({ where: { id: { in: ownerIds } }, data: { userId: id } }),
  ]);
  const updated = await requireUser(id);
  await audit({
    action: "user.owners_changed",
    actorId: actor.id,
    entityType: "user",
    entityId: id,
    meta: { name: updated.name, owners: updated.owners.map((x) => x.name) },
  });
  return updated;
}

/** Replaces one role's defaults; only differences from the built-ins are stored. Returns every role's effective set. */
export async function setRoleDefaults(
  role: unknown,
  permissions: unknown,
  actor: AuthUser,
): Promise<Record<Role, PermissionSet>> {
  const parsed = sanitizeRoleRows(role, permissions);
  if (!parsed.ok) throw new AdminError(parsed.error);
  if (actor.role !== "ADMIN") {
    // Changing a role changes everyone in it, so it can't exceed what the actor holds themselves.
    const over = parsed.rows.find((r) => RANK[r.scope] > RANK[scopeFor(actor.permissions, r.resource, r.action)]);
    if (over) {
      throw new AdminError(`You can't grant more access than you have yourself (${over.resource}: ${over.action}).`, 403);
    }
  }

  const changed = diffAgainstDefaults(parsed.role, parsed.rows);
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { role: parsed.role } }),
    prisma.rolePermission.createMany({
      data: changed.map((r) => ({ role: parsed.role, resource: r.resource, action: r.action, scope: r.scope })),
    }),
  ]);
  await audit({ action: "role.permissions_changed", actorId: actor.id, entityType: "role", entityId: parsed.role, meta: { role: parsed.role, differsFromBuiltIn: changed.length } });
  return loadRoleMatrix();
}

/** Permanently deletes a user. Not yourself, and never the last active admin. Their sessions end immediately. */
export async function deleteUser(id: string, actor: AuthUser): Promise<AdminUserDto> {
  const user = await requireUser(id);
  guardTarget(actor, user);
  if (id === actor.id) throw new AdminError("You can't delete your own account.", 409);

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true, active: true } });
  if (wouldLoseLastAdmin(admins, id, { active: false })) {
    throw new AdminError("That would leave no active admin. Make another user an admin first.", 409);
  }
  await prisma.user.delete({ where: { id } });
  await audit({ action: "user.deleted", actorId: actor.id, entityType: "user", entityId: id, meta: { name: user.name, email: user.email, role: user.role } });
  return user;
}

/** Finds users by id, exact email, or a name/email fragment. Several results means the caller must disambiguate. */
export async function findUsers(identifier: string): Promise<AdminUserDto[]> {
  const q = identifier.trim();
  if (!q) return [];
  const exact = await prisma.user.findFirst({
    where: { OR: [{ id: q }, { email: { equals: q, mode: "insensitive" } }] },
    include: ADMIN_USER_INCLUDE,
  });
  if (exact) return [toAdminUserDto(exact)];

  const tokens = q.split(/\s+/).filter(Boolean);
  const rows = await prisma.user.findMany({
    where: {
      AND: tokens.map((t) => ({
        OR: [{ name: { contains: t, mode: "insensitive" } }, { email: { contains: t, mode: "insensitive" } }],
      })),
    },
    include: ADMIN_USER_INCLUDE,
    orderBy: { name: "asc" },
    take: 10,
  });
  return rows.map(toAdminUserDto);
}

export { getAdminUser, getUserOverrides, listAdminUsers, loadRoleMatrix };
