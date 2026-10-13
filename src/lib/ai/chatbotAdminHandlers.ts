import "server-only";
import { prisma } from "@/lib/prisma";
import type { ChatbotContext } from "@/lib/ai/chatbotContext";
import {
  AdminError,
  createUser,
  deleteUser,
  findUsers,
  getUserOverrides,
  listAdminUsers,
  loadRoleMatrix,
  resetUserPassword,
  setRoleDefaults,
  setUserOverrides,
  setUserOwners,
  updateUser,
} from "@/lib/auth/adminService";
import type { AdminUserDto } from "@/lib/auth/adminUsers";
import { suggestUsername } from "@/lib/auth/passwordStrength";
import { getEmailDomain } from "@/lib/emailDomainSettings";
import { ROLES, type PermissionSet, type Role } from "@/lib/auth/permissions";
import { ACTION_LABELS, RESOURCE_LABELS, ROLE_LABELS } from "@/lib/auth/permissionLabels";
import { describePermissionSet } from "@/lib/ai/chatbotContextPrompt";

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function summary(u: AdminUserDto) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    mustChangePassword: u.mustChangePassword,
    ownerNames: u.owners.map((o) => o.name),
    customPermissionCount: u.overrideCount,
  };
}

function accessWord(scope: string): string {
  return scope === "ALL" ? "all" : scope === "OWN" ? "own items only" : "off";
}

function describeOverrides(overrides: Record<string, string>) {
  return Object.entries(overrides).map(([key, scope]) => {
    const [resource, action] = key.split(":");
    return { area: RESOURCE_LABELS[resource] ?? resource, action: ACTION_LABELS[action] ?? action, access: accessWord(scope) };
  });
}

/** Turns the model's { "projects:view": "INHERIT" | "ALL" … } into the service format (INHERIT → null). */
function toOverrideMap(value: unknown, allowInherit: boolean): Record<string, string | null> | { error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { error: "permissions must be an object of \"area:action\": ALL | OWN | NONE." };
  }
  const out: Record<string, string | null> = {};
  for (const [key, raw] of Object.entries(value)) {
    const v = typeof raw === "string" ? raw.trim().toUpperCase() : "";
    if (v === "INHERIT") {
      if (!allowInherit) return { error: "INHERIT only applies to a single user's overrides, not to a role." };
      out[key] = null;
    } else {
      out[key] = v;
    }
  }
  return out;
}

function failure(error: unknown) {
  if (error instanceof AdminError) {
    return {
      error: error.message,
      ...(error.status === 403 ? { note: "Not allowed. Explain briefly; do not retry or look for a workaround." } : {}),
    };
  }
  throw error;
}

/** Names that don't exist yet are created so they can be linked; lookup is case-insensitive. */
async function ownerIdsForNames(names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const existing = await prisma.owner.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    ids.push(existing ? existing.id : (await prisma.owner.create({ data: { name } })).id);
  }
  return ids;
}

/** User-management tool handlers, bound to the signed-in actor. All rules live in adminService. */
export function buildAdminHandlers(ctx: ChatbotContext): Record<string, Handler> {
  const actor = ctx.user;

  async function resolveOne(args: Record<string, unknown>): Promise<{ user: AdminUserDto } | { error: unknown }> {
    const identifier = str(args.identifier);
    if (!identifier) return { error: { error: "identifier is required — a user's email, name or id. Ask who it is." } };
    const matches = await findUsers(identifier);
    if (matches.length === 0) {
      return { error: { error: `No user matches "${identifier}". Call list_users to see the accounts.` } };
    }
    if (matches.length > 1) {
      return { error: { error: "Several users match — ask which one the person means.", matches: matches.map(summary) } };
    }
    return { user: matches[0] };
  }

  return {
    list_users: async (args) => {
      const q = str(args.q).toLowerCase();
      const tokens = q.split(/\s+/).filter(Boolean);
      const users = (await listAdminUsers()).filter((u) =>
        tokens.every((t) => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(t)),
      );
      return { count: users.length, users: users.map(summary) };
    },

    get_user: async (args) => {
      const found = await resolveOne(args);
      if ("error" in found) return found.error;
      const overrides = await getUserOverrides(found.user.id);
      return {
        user: summary(found.user),
        customPermissions: describeOverrides(overrides),
        note: found.user.role === "ADMIN" ? "Admins always have full access." : "Everything not listed follows the role's defaults.",
      };
    },

    create_user: async (args) => {
      const firstName = str(args.firstName);
      const lastName = str(args.lastName);
      const role = str(args.role).toUpperCase();
      if (!firstName) return { error: "firstName is required — ask for the person's first name." };
      if (!role) return { error: "role is required — ask which role: ADMIN, MANAGER, MEMBER or VIEWER. Do not guess." };
      if (!(ROLES as readonly string[]).includes(role)) {
        return { error: `Unknown role "${role}". Valid roles: ${ROLES.join(", ")}.` };
      }

      const domain = await getEmailDomain();
      const email = str(args.email) || suggestUsername(firstName, lastName, domain);
      let overrides: Record<string, string | null> | undefined;
      if (args.overrides !== undefined) {
        const mapped = toOverrideMap(args.overrides, true);
        if ("error" in mapped) return mapped;
        // For a new user "inherit" simply means no override.
        overrides = Object.fromEntries(Object.entries(mapped).filter(([, v]) => v !== null));
      }

      try {
        const { user, generatedPassword } = await createUser(
          {
            firstName,
            lastName,
            email,
            role,
            password: str(args.password) || undefined,
            mustChangePassword: args.requireChange !== false,
            overrides,
          },
          actor,
        );
        return {
          created: true,
          user: summary(user),
          passwordGenerated: generatedPassword !== null,
          ...(generatedPassword
            ? { credentials: { email: user.email, password: generatedPassword, note: "They must set a new password at first sign-in." } }
            : {}),
          next:
            role === "ADMIN"
              ? undefined
              : "If their access is limited to own items, remind the admin to link their owner names (link_user_owners).",
        };
      } catch (error) {
        return failure(error);
      }
    },

    update_user: async (args) => {
      const found = await resolveOne(args);
      if ("error" in found) return found.error;
      const patch: Record<string, unknown> = {};
      if (str(args.name)) patch.name = str(args.name);
      if (str(args.role)) patch.role = str(args.role).toUpperCase();
      if (typeof args.active === "boolean") patch.active = args.active;
      if (Object.keys(patch).length === 0) {
        return { error: "Nothing to change — ask what to update: name, role, or active status." };
      }
      try {
        return { updated: true, user: summary(await updateUser(found.user.id, patch, actor)) };
      } catch (error) {
        return failure(error);
      }
    },

    reset_user_password: async (args) => {
      const found = await resolveOne(args);
      if ("error" in found) return found.error;
      if (args.confirm !== true) {
        return { requiresConfirmation: true, action: "reset_password", user: { id: found.user.id, name: found.user.name } };
      }
      try {
        const password = await resetUserPassword(found.user.id, actor);
        return {
          reset: true,
          user: summary(found.user),
          credentials: { email: found.user.email, password, note: "They were signed out everywhere and must set a new password at next sign-in." },
        };
      } catch (error) {
        return failure(error);
      }
    },

    delete_user: async (args) => {
      const found = await resolveOne(args);
      if ("error" in found) return found.error;
      if (args.confirm !== true) {
        return { requiresConfirmation: true, action: "delete_user", user: { id: found.user.id, name: found.user.name } };
      }
      try {
        const removed = await deleteUser(found.user.id, actor);
        return { deleted: true, id: removed.id, name: removed.name };
      } catch (error) {
        return failure(error);
      }
    },

    set_user_permissions: async (args) => {
      const found = await resolveOne(args);
      if ("error" in found) return found.error;
      const mapped = toOverrideMap(args.permissions, true);
      if ("error" in mapped) return mapped;
      if (Object.keys(mapped).length === 0) return { error: "No permissions given — ask which areas and actions to change." };
      try {
        const overrides = await setUserOverrides(found.user.id, mapped, actor);
        return { updated: true, user: found.user.name, customPermissions: describeOverrides(overrides) };
      } catch (error) {
        return failure(error);
      }
    },

    link_user_owners: async (args) => {
      const found = await resolveOne(args);
      if ("error" in found) return found.error;
      const names = Array.isArray(args.ownerNames) ? args.ownerNames.map(str).filter(Boolean) : [];
      try {
        const updated = await setUserOwners(found.user.id, await ownerIdsForNames(names), actor);
        return { linked: true, user: updated.name, ownerNames: updated.owners.map((o) => o.name) };
      } catch (error) {
        return failure(error);
      }
    },

    get_role_permissions: async (args) => {
      const matrix = await loadRoleMatrix();
      const wanted = str(args.role).toUpperCase();
      const roles = (wanted ? [wanted] : [...ROLES]).filter((r): r is Role => (ROLES as readonly string[]).includes(r));
      if (roles.length === 0) return { error: `Unknown role. Valid roles: ${ROLES.join(", ")}.` };
      return {
        roles: roles.map((role) => ({ role, label: ROLE_LABELS[role], ...describePermissionSet(matrix[role] as PermissionSet) })),
      };
    },

    set_role_permissions: async (args) => {
      const role = str(args.role).toUpperCase();
      if (!(ROLES as readonly string[]).includes(role) || role === "ADMIN") {
        return { error: "role must be MANAGER, MEMBER or VIEWER (the Admin role can't be edited)." };
      }
      const mapped = toOverrideMap(args.permissions, false);
      if ("error" in mapped) return mapped;
      if (Object.keys(mapped).length === 0) return { error: "No permissions given — ask which areas and actions to change." };

      if (args.confirm !== true) {
        return { requiresConfirmation: true, action: "role_permissions", role, changes: describeOverrides(mapped as Record<string, string>) };
      }
      try {
        const current = (await loadRoleMatrix())[role as Role];
        const merged = { ...current, ...mapped };
        const matrix = await setRoleDefaults(role, merged, actor);
        return { updated: true, role, ...describePermissionSet(matrix[role as Role]) };
      } catch (error) {
        return failure(error);
      }
    },
  };
}
