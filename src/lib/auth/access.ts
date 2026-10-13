import { scopeFor, type PermissionSet, type Role, type Scope } from "@/lib/auth/permissions";

const PUBLIC_PAGES = ["/login", "/forgot-password"];
const PUBLIC_API = ["/api/auth/login", "/api/auth/forgot"];

/** Paths reachable without a session. Exact match only, so "/loginx" and traversal tricks stay private. */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PAGES.includes(pathname) || PUBLIC_API.includes(pathname);
}

export type AuthorizableUser = { id: string; role: Role; permissions: PermissionSet };

export type AuthorizeResult =
  | { ok: true; scope: Scope }
  | { ok: false; status: 401 | 403; error: string };

export function authorizeUser(
  user: AuthorizableUser | null,
  resource: string,
  action: string,
): AuthorizeResult {
  if (!user) return { ok: false, status: 401, error: "Authentication required" };
  const scope = scopeFor(user.permissions, resource, action);
  if (scope === "NONE") return { ok: false, status: 403, error: "Forbidden" };
  return { ok: true, scope };
}

/** Post-login redirect target: same-site relative paths only, never the login page itself. */
export function safeRedirectTarget(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  if (raw === "/login" || raw.startsWith("/login?")) return "/";
  return raw;
}
