import { randomInt } from "node:crypto";
import { validatePasswordStrength, type PasswordPolicy } from "@/lib/auth/passwordStrength";
import {
  DEFAULT_ROLE_MATRIX,
  ROLES,
  actionsFor,
  allowsOwnScope,
  permissionKey,
  RESOURCES,
  resolvePermissions,
  type PermissionRow,
  type PermissionSet,
  type Role,
  type Scope,
} from "@/lib/auth/permissions";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const SCOPES: Scope[] = ["NONE", "OWN", "ALL"];

function parseKey(key: string): { resource: string; action: string } | null {
  const [resource, action, ...rest] = key.split(":");
  if (!resource || !action || rest.length > 0) return null;
  if (!(RESOURCES as readonly string[]).includes(resource)) return null;
  if (!actionsFor(resource).includes(action as never)) return null;
  return { resource, action };
}

function checkScope(resource: string, action: string, scope: unknown): scope is Scope {
  if (typeof scope !== "string" || !SCOPES.includes(scope as Scope)) return false;
  return scope !== "OWN" || allowsOwnScope(resource, action);
}

/** Validates a per-user override map: key "resource:action" → scope, or null to remove the override. */
export function sanitizeOverrides(
  input: unknown,
): Result<{ set: PermissionRow[]; clear: { resource: string; action: string }[] }> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Permissions must be an object." };
  }
  const set: PermissionRow[] = [];
  const clear: { resource: string; action: string }[] = [];
  for (const [key, value] of Object.entries(input)) {
    const parsed = parseKey(key);
    if (!parsed) return { ok: false, error: `Unknown permission "${key}".` };
    if (value === null) {
      clear.push(parsed);
      continue;
    }
    if (!checkScope(parsed.resource, parsed.action, value)) {
      return { ok: false, error: `Invalid value for "${key}".` };
    }
    set.push({ ...parsed, scope: value });
  }
  return { ok: true, set, clear };
}

/** Validates a role-default matrix edit. The ADMIN role is fixed and cannot be edited. */
export function sanitizeRoleRows(role: unknown, input: unknown): Result<{ role: Role; rows: PermissionRow[] }> {
  if (typeof role !== "string" || !(ROLES as readonly string[]).includes(role)) {
    return { ok: false, error: "Unknown role." };
  }
  if (role === "ADMIN") return { ok: false, error: "The Admin role always has full access and can't be edited." };
  const parsed = sanitizeOverrides(input);
  if (!parsed.ok) return parsed;
  if (parsed.clear.length > 0) return { ok: false, error: "Role permissions can't be cleared, only set." };
  return { ok: true, role: role as Role, rows: parsed.set };
}

/** Keeps only rows that differ from the built-in defaults, so default changes in code still flow through. */
export function diffAgainstDefaults(role: Role, rows: PermissionRow[]): PermissionRow[] {
  const defaults = new Map(DEFAULT_ROLE_MATRIX[role].map((r) => [permissionKey(r.resource, r.action), r.scope]));
  return rows.filter((r) => (defaults.get(permissionKey(r.resource, r.action)) ?? "NONE") !== r.scope);
}

/** True when applying `change` to `targetId` would leave no active admin. */
export function wouldLoseLastAdmin(
  admins: { id: string; active: boolean }[],
  targetId: string,
  change: { role?: string; active?: boolean; name?: string },
): boolean {
  const target = admins.find((a) => a.id === targetId);
  if (!target || !target.active) return false;
  const demotes = change.role !== undefined && change.role !== "ADMIN";
  const deactivates = change.active === false;
  if (!demotes && !deactivates) return false;
  return !admins.some((a) => a.id !== targetId && a.active);
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 14-char temporary password that always satisfies the strength rule (has a letter and a digit). */
export function generateTempPassword(): string {
  const chars = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return `${chars.join("")}${randomInt(2, 10)}x`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NewUserInput = {
  email: string;
  name: string;
  role: Role;
  /** null = the server generates a temporary password. */
  password: string | null;
  mustChangePassword: boolean;
  overrides: PermissionRow[];
};

/**
 * Validates the create-user form. Accepts firstName/lastName (or a single name), an optional
 * admin-chosen password, whether to force a change at first sign-in, and per-user permission overrides.
 */
export function validateNewUser(input: unknown, policy?: PasswordPolicy): Result<{ value: NewUserInput }> {
  const raw = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const email = str(raw.email).toLowerCase();
  const name = raw.firstName !== undefined || raw.lastName !== undefined
    ? `${str(raw.firstName)} ${str(raw.lastName)}`.trim()
    : str(raw.name);
  const role = raw.role;
  if (raw.firstName !== undefined && !str(raw.firstName)) return { ok: false, error: "First name is required." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid username (email address)." };
  if (!name) return { ok: false, error: "Name is required." };
  if (typeof role !== "string" || !(ROLES as readonly string[]).includes(role)) {
    return { ok: false, error: "Choose a valid role." };
  }

  let password: string | null = null;
  if (raw.password !== undefined && raw.password !== null && raw.password !== "") {
    if (typeof raw.password !== "string") return { ok: false, error: "Invalid password." };
    const weakness = validatePasswordStrength(raw.password, policy);
    if (weakness) return { ok: false, error: weakness };
    password = raw.password;
  }

  let overrides: PermissionRow[] = [];
  if (raw.overrides !== undefined && role !== "ADMIN") {
    const parsed = sanitizeOverrides(raw.overrides);
    if (!parsed.ok) return parsed;
    overrides = parsed.set;
  }

  return {
    ok: true,
    value: {
      email,
      name,
      role: role as Role,
      password,
      mustChangePassword: raw.mustChangePassword !== false,
      overrides,
    },
  };
}

const RANK: Record<Scope, number> = { NONE: 0, OWN: 1, ALL: 2 };

type Actor = { role: Role; permissions: PermissionSet };

/**
 * Privilege-escalation guard for whoever manages users. Admins may do anything. Anyone else may not touch
 * admin accounts, assign the Admin role, or give a user (via role or overrides) more access than they hold themselves.
 * Returns an error message, or null when allowed.
 */
export function escalationError(
  actor: Actor,
  targetRole: Role,
  overrides: PermissionRow[],
  roleDefaults: Record<Role, PermissionSet>,
): string | null {
  if (actor.role === "ADMIN") return null;
  if (targetRole === "ADMIN") return "Only admins can give someone the Admin role.";
  const effective = resolvePermissions(targetRole, DEFAULT_ROLE_MATRIX[targetRole], overrides);
  const base = roleDefaults[targetRole] ?? effective;
  for (const key of new Set([...Object.keys(effective), ...Object.keys(base)])) {
    const wanted = overrides.find((o) => permissionKey(o.resource, o.action) === key)?.scope ?? base[key] ?? "NONE";
    const own = actor.permissions[key] ?? "NONE";
    if (RANK[wanted] > RANK[own]) {
      const [resource, action] = key.split(":");
      return `You can't grant more access than you have yourself (${resource}: ${action}).`;
    }
  }
  return null;
}

/** Roles this actor is allowed to assign (admins: all). Used to tell the chatbot and UIs what is on offer. */
export function assignableRoles(actor: Actor, roleDefaults: Record<Role, PermissionSet>): Role[] {
  return ROLES.filter((role) => escalationError(actor, role, [], roleDefaults) === null);
}

/** True when a non-admin actor would be touching an admin account. */
export function touchesAdmin(actor: Actor, targetRole: string): boolean {
  return actor.role !== "ADMIN" && targetRole === "ADMIN";
}
