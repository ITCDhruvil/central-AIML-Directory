import type { ToolDefinition } from "@/lib/ai/chatTypes";
import { allPermissionKeys, ROLES } from "@/lib/auth/permissions";

const PERMISSION_KEYS = allPermissionKeys().join(", ");

const IDENTIFIER = {
  type: "string",
  description: "The user's id, exact email address, or name. If several users match you get a list back — ask which one.",
} as const;

const PERMISSION_MAP = {
  type: "object",
  description:
    'Map of "area:action" to ALL, OWN, NONE (and INHERIT to drop an override). OWN means only items the user owns or that were shared with them; ALL means everything. ' +
    "Create and AI toggles only accept ALL or NONE (documents:create also accepts OWN). " +
    `Valid keys: ${PERMISSION_KEYS}.`,
  additionalProperties: { type: "string", enum: ["ALL", "OWN", "NONE", "INHERIT"] },
} as const;

/** User-management tools. Offered only to users holding the matching users:* permission. */
export const ADMIN_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_users",
      description: "List or search user accounts (name, email, role, active, linked owner names). Use before changing a user so you have the right one.",
      parameters: {
        type: "object",
        properties: { q: { type: "string", description: "Optional name or email fragment." } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user",
      description:
        "Show one user in full: role, active status, linked owner names, and every permission that differs from their role's default.",
      parameters: { type: "object", properties: { identifier: IDENTIFIER }, required: ["identifier"] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_user",
      description:
        "Create a user account. REQUIRED from the user before calling: first name and role — ask if either is missing, never guess a role. " +
        "email is the sign-in username; if the user doesn't give one it defaults to first.last@<your domain>. Ask whether to generate a password or use a specific one; " +
        "if none is given a strong temporary password is generated and shown to the admin in a card (you never see it). " +
        "The new user must change it at first sign-in unless requireChange is false. overrides adds permissions on top of the role. " +
        "You can only assign roles and permissions that do not exceed your own access.",
      parameters: {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string", description: "Sign-in username (an email address). Optional." },
          role: { type: "string", enum: [...ROLES] },
          password: { type: "string", description: "Only when the admin chose one. Omit to auto-generate." },
          requireChange: { type: "boolean", description: "Force a new password at first sign-in. Default true." },
          overrides: PERMISSION_MAP,
        },
        required: ["firstName", "role"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_user",
      description:
        "Change a user's name, role, or active status (active:false deactivates and blocks sign-in, reversible). " +
        "Cannot leave the app without an active admin. Only admins can change admin accounts or assign the Admin role.",
      parameters: {
        type: "object",
        properties: {
          identifier: IDENTIFIER,
          name: { type: "string" },
          role: { type: "string", enum: [...ROLES] },
          active: { type: "boolean" },
        },
        required: ["identifier"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reset_user_password",
      description:
        "Reset a user's password: signs them out everywhere and gives a new temporary password (shown to the admin in a card) they must change at next sign-in. " +
        "DISRUPTIVE: call first without confirm so Yes/Cancel buttons appear; only call again with confirm:true after the user clicks Yes.",
      parameters: {
        type: "object",
        properties: { identifier: IDENTIFIER, confirm: { type: "boolean" } },
        required: ["identifier"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_user",
      description:
        "Permanently delete a user account. DESTRUCTIVE and irreversible (deactivating via update_user is the reversible option — offer it). " +
        "Cannot delete yourself or the last active admin. Call first without confirm so Yes/Cancel buttons appear; only call again with confirm:true after the user clicks Yes.",
      parameters: {
        type: "object",
        properties: { identifier: IDENTIFIER, confirm: { type: "boolean" } },
        required: ["identifier"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_user_permissions",
      description:
        "Give one user permissions that differ from their role's default (or remove such overrides with INHERIT). Admins always have full access so this does nothing for them. " +
        "You can't grant more than you hold yourself.",
      parameters: {
        type: "object",
        properties: { identifier: IDENTIFIER, permissions: PERMISSION_MAP },
        required: ["identifier", "permissions"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "link_user_owners",
      description:
        "Set which owner names belong to a user, so items owned by those names count as that user's own (used when their access is limited to OWN). " +
        "Replaces the current list. Names that don't exist yet are created.",
      parameters: {
        type: "object",
        properties: { identifier: IDENTIFIER, ownerNames: { type: "array", items: { type: "string" } } },
        required: ["identifier", "ownerNames"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_role_permissions",
      description: "Show what each role (or one role) can do by default: for every area and action, OFF / OWN / ALL.",
      parameters: { type: "object", properties: { role: { type: "string", enum: [...ROLES] } } },
    },
  },
  {
    type: "function",
    function: {
      name: "set_role_permissions",
      description:
        "Change the default permissions of a whole role (affects every user with that role). Only the entries you pass change; the rest stay as they are. The Admin role can't be edited. " +
        "WIDE-REACHING: call first without confirm so Yes/Cancel buttons appear; only call again with confirm:true after the user clicks Yes. You can't grant more than you hold yourself.",
      parameters: {
        type: "object",
        properties: {
          role: { type: "string", enum: ROLES.filter((r) => r !== "ADMIN") },
          permissions: { ...PERMISSION_MAP, description: PERMISSION_MAP.description.replace(", and INHERIT to drop an override", "") },
          confirm: { type: "boolean" },
        },
        required: ["role", "permissions"],
      },
    },
  },
];
