// Pure permission engine — no DB, no Next imports. The DAL loads rows and feeds them here.

export const ROLES = ["ADMIN", "MANAGER", "MEMBER", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const DATA_RESOURCES = [
  "projects",
  "ideas",
  "documents",
  "insights",
  "search",
  "owners",
  "settings",
  "users",
] as const;

// AI features are permission resources with the single action "use".
export const AI_FEATURES = [
  "ai_chatbot",
  "ai_text_transform",
  "ai_project_assistant",
  "ai_insights",
  "ai_github_autofill",
  "ai_web_search",
] as const;

export const RESOURCES = [...DATA_RESOURCES, ...AI_FEATURES] as const;
export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = ["view", "create", "edit", "delete", "use"] as const;
export type Action = (typeof ACTIONS)[number];

export type Scope = "NONE" | "OWN" | "ALL";

export type PermissionRow = { resource: string; action: string; scope: Scope };
// Keyed "resource:action".
export type PermissionSet = Record<string, Scope>;

export function permissionKey(resource: string, action: string): string {
  return `${resource}:${action}`;
}

/** Which actions are meaningful for a resource (drives matrix UIs and defaults). */
export function actionsFor(resource: string): Action[] {
  if ((AI_FEATURES as readonly string[]).includes(resource)) return ["use"];
  if (resource === "search" || resource === "insights") return ["view", "create"];
  return ["view", "create", "edit", "delete"];
}

/** "Own" only means something when there is an owner to compare: reads/changes of items, or documents inside a project. */
export function allowsOwnScope(resource: string, action: string): boolean {
  if (action === "view" || action === "edit" || action === "delete") return true;
  if (action === "create") return resource === "documents";
  return false;
}

export function allPermissionKeys(): string[] {
  return RESOURCES.flatMap((r) => actionsFor(r).map((a) => permissionKey(r, a)));
}

function matrix(entries: Record<string, Scope>): PermissionRow[] {
  const rows: PermissionRow[] = [];
  for (const key of allPermissionKeys()) {
    const [resource, action] = key.split(":");
    rows.push({ resource, action, scope: entries[key] ?? "NONE" });
  }
  return rows;
}

function all(): Record<string, Scope> {
  return Object.fromEntries(allPermissionKeys().map((k) => [k, "ALL" as Scope]));
}

const MANAGER: Record<string, Scope> = {
  ...all(),
  "users:view": "NONE",
  "users:create": "NONE",
  "users:edit": "NONE",
  "users:delete": "NONE",
  "settings:create": "NONE",
  "settings:edit": "NONE",
  "settings:delete": "NONE",
};

const MEMBER: Record<string, Scope> = {
  "projects:view": "OWN",
  "projects:create": "ALL",
  "projects:edit": "OWN",
  "ideas:view": "OWN",
  "ideas:create": "ALL",
  "ideas:edit": "OWN",
  "documents:view": "OWN",
  // Documents hang off a project, so "create" is scoped to projects the user owns.
  "documents:create": "OWN",
  "documents:edit": "OWN",
  "search:view": "OWN",
  "owners:view": "ALL",
  "ai_chatbot:use": "ALL",
  "ai_text_transform:use": "ALL",
  "ai_project_assistant:use": "ALL",
};

const VIEWER: Record<string, Scope> = {
  "projects:view": "OWN",
  "ideas:view": "OWN",
  "documents:view": "OWN",
  "search:view": "OWN",
};

/** Built-in defaults. Admin edits (RolePermission rows) override these per role. */
export const DEFAULT_ROLE_MATRIX: Record<Role, PermissionRow[]> = {
  ADMIN: matrix(all()),
  MANAGER: matrix(MANAGER),
  MEMBER: matrix(MEMBER),
  VIEWER: matrix(VIEWER),
};

/**
 * Effective permissions: built-in role defaults, then DB role rows, then per-user overrides.
 * Admin role is never reduced below ALL for the "users" resource (lockout guard).
 */
export function resolvePermissions(
  role: Role,
  defaults: PermissionRow[],
  userOverrides: PermissionRow[],
  dbRoleRows: PermissionRow[] = [],
): PermissionSet {
  const set: PermissionSet = {};
  for (const row of [...defaults, ...dbRoleRows, ...userOverrides]) {
    set[permissionKey(row.resource, row.action)] = row.scope;
  }
  if (role === "ADMIN") {
    for (const action of actionsFor("users")) set[permissionKey("users", action)] = "ALL";
  }
  return set;
}

export function scopeFor(perms: PermissionSet, resource: string, action: string): Scope {
  return perms[permissionKey(resource, action)] ?? "NONE";
}

export function can(perms: PermissionSet, resource: string, action: string): boolean {
  return scopeFor(perms, resource, action) !== "NONE";
}
