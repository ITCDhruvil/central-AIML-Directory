import "server-only";
import { cache } from "react";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { authorizeUser, type AuthorizeResult } from "@/lib/auth/access";
import {
  DEFAULT_ROLE_MATRIX,
  ROLES,
  resolvePermissions,
  scopeFor,
  type PermissionRow,
  type Role,
  type Scope,
} from "@/lib/auth/permissions";
import type { AccessScope } from "@/lib/auth/scope";
import { loadAccessScope } from "@/lib/auth/scopeLoader";
import { readSession } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/auth/types";

function asRole(value: string): Role {
  return (ROLES as readonly string[]).includes(value) ? (value as Role) : "VIEWER";
}

function asRows(rows: { resource: string; action: string; scope: string }[]): PermissionRow[] {
  return rows.map((r) => ({ resource: r.resource, action: r.action, scope: r.scope as Scope }));
}

/**
 * Data access layer: the single place that turns the session cookie into a user.
 * Rejects deactivated users and sessions invalidated by a sessionVersion bump.
 * Memoised per request.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await readSession();
  if (!session) return null;

  // Every page and API call starts here, and each database round trip costs tens of milliseconds. These four lookups do
  // not depend on each other (the role table is small, so it is read whole and filtered to this user's role below), so
  // they are sent together and cost one round trip instead of four in a row.
  const [user, overrides, avatar, allRoleRows] = await Promise.all([
    // The password hash is only needed when signing in, never to know who is making a request.
    prisma.user.findUnique({ where: { id: session.uid }, omit: { passwordHash: true } }),
    prisma.userPermission.findMany({ where: { userId: session.uid } }),
    prisma.userAvatar.findUnique({ where: { userId: session.uid }, select: { updatedAt: true } }),
    prisma.rolePermission.findMany(),
  ]);
  if (!user || !user.active || user.sessionVersion !== session.sv) return null;

  const role = asRole(user.role);
  const permissions = resolvePermissions(
    role,
    DEFAULT_ROLE_MATRIX[role],
    asRows(overrides),
    asRows(allRoleRows.filter((row) => row.role === role)),
  );

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    mustChangePassword: user.mustChangePassword,
    avatarVersion: avatar?.updatedAt.getTime() ?? null,
    permissions,
  };
});

/** For pages / layouts: redirects to /login (or the forced password change) when needed. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return user;
}

export type ViewAccess = { projects: AccessScope; ideas: AccessScope; documents: AccessScope };

/**
 * What the user may view per entity kind. For features that read several kinds at once
 * (search, dashboard, chatbot) — each kind must follow its own permission, not one shared scope.
 */
export async function loadViewAccess(user: AuthUser): Promise<ViewAccess> {
  const [projects, ideas, documents] = await Promise.all(
    (["projects", "ideas", "documents"] as const).map((resource) =>
      loadAccessScope(user, scopeFor(user.permissions, resource, "view"), "view"),
    ),
  );
  return { projects, ideas, documents };
}

export type PageAuth = { user: AuthUser; scope: Scope; access: AccessScope };

/** For pages: requireUser plus a permission check; sends the user home when denied. */
export async function requirePagePermission(resource: string, action: string): Promise<PageAuth> {
  const user = await requireUser();
  const result = authorizeUser(user, resource, action);
  if (!result.ok) redirect("/");
  return { user, scope: result.scope, access: await loadAccessScope(user, result.scope, action) };
}

export type ApiAuth =
  | { ok: true; user: AuthUser; scope: Scope; access: AccessScope }
  | { ok: false; response: NextResponse };

/**
 * For directory-wide features (insights) whose output mixes every project: a user limited to
 * "own" items must not reach them. Returns a 403 response to send, or null when allowed.
 */
export function denyUnlessFullAccess(auth: Extract<ApiAuth, { ok: true }>): NextResponse | null {
  if (auth.access.all) return null;
  return NextResponse.json({ error: "This feature needs access to all projects." }, { status: 403 });
}

/**
 * For route handlers. Usage:
 *   const auth = await apiAuthorize("projects", "view");
 *   if (!auth.ok) return auth.response;
 */
export async function apiAuthorize(resource: string, action: string): Promise<ApiAuth> {
  const user = await getCurrentUser();
  if (user?.mustChangePassword) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Password change required" }, { status: 403 }),
    };
  }
  const result: AuthorizeResult = authorizeUser(user, resource, action);
  if (!result.ok) {
    return { ok: false, response: NextResponse.json({ error: result.error }, { status: result.status }) };
  }
  const authed = user as AuthUser;
  return { ok: true, user: authed, scope: result.scope, access: await loadAccessScope(authed, result.scope, action) };
}
