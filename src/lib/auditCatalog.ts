// Browser-safe: the list of recorded events, their labels and grouping, shared by the writer and the admin page.

export type AuditCategory = "Sign-in" | "Users & access" | "Settings" | "Projects" | "Ideas" | "Documents";

export const AUDIT_ACTIONS = {
  "auth.login": { label: "Signed in", category: "Sign-in" },
  "auth.login_failed": { label: "Failed sign-in", category: "Sign-in" },
  "auth.logout": { label: "Signed out", category: "Sign-in" },
  "auth.password_changed": { label: "Changed own password", category: "Sign-in" },
  "auth.password_reset_requested": { label: "Asked for a password reset", category: "Sign-in" },
  "auth.password_auto_issued": { label: "Temporary password issued automatically", category: "Sign-in" },

  "user.created": { label: "Created a user", category: "Users & access" },
  "user.updated": { label: "Updated a user", category: "Users & access" },
  "user.deleted": { label: "Deleted a user", category: "Users & access" },
  "user.password_reset": { label: "Set a temporary password", category: "Users & access" },
  "user.permissions_changed": { label: "Changed a user's permissions", category: "Users & access" },
  "user.avatar_changed": { label: "Changed their profile picture", category: "Users & access" },
  "user.owners_changed": { label: "Changed a user's owner names", category: "Users & access" },
  "role.permissions_changed": { label: "Changed role defaults", category: "Users & access" },

  "settings.email_domain": { label: "Changed the sign-in domain", category: "Settings" },
  "settings.security_policy": { label: "Changed the security policy", category: "Settings" },
  "settings.ai": { label: "Changed AI settings", category: "Settings" },
  "settings.ai_quota": { label: "Changed a person's AI limits", category: "Settings" },
  "settings.branding": { label: "Changed the workspace name", category: "Settings" },
  "data.exported": { label: "Exported data", category: "Settings" },
  "owner.deleted": { label: "Removed an owner name", category: "Settings" },

  "project.created": { label: "Created a project", category: "Projects" },
  "project.updated": { label: "Edited a project", category: "Projects" },
  "project.deleted": { label: "Deleted a project", category: "Projects" },

  "idea.created": { label: "Created an idea", category: "Ideas" },
  "idea.updated": { label: "Edited an idea", category: "Ideas" },
  "idea.deleted": { label: "Deleted an idea", category: "Ideas" },
  "idea.promoted": { label: "Promoted an idea to a project", category: "Ideas" },

  "document.created": { label: "Created a document", category: "Documents" },
  "document.updated": { label: "Edited a document", category: "Documents" },
  "document.deleted": { label: "Deleted a document", category: "Documents" },
} as const satisfies Record<string, { label: string; category: AuditCategory }>;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export const AUDIT_CATEGORIES: AuditCategory[] = ["Sign-in", "Users & access", "Settings", "Projects", "Ideas", "Documents"];

export function actionLabel(action: string): string {
  return (AUDIT_ACTIONS as Record<string, { label: string }>)[action]?.label ?? action;
}

export function actionsIn(category: AuditCategory): AuditAction[] {
  return (Object.keys(AUDIT_ACTIONS) as AuditAction[]).filter((a) => AUDIT_ACTIONS[a].category === category);
}

// A key is secret when it ENDS in one of these words (password, newPassword, sessionToken, passwordHash, apiKey…).
// Matching anywhere in the key would also drop harmless settings such as passwordMinLength or defaultMonthlyTokens.
const SECRET_KEY = /(pass(word|wd)?|secret|token|hash|authorization|cookie|api[-_]?key)$/i;
const MAX_STRING = 200;
const MAX_KEYS = 20;

/**
 * Makes a metadata object safe to store: anything that looks like a secret is dropped, long text is cut, and only
 * plain values are kept. The audit log records what happened, never credentials.
 */
export function sanitizeMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!meta) return out;
  for (const [key, value] of Object.entries(meta).slice(0, MAX_KEYS)) {
    if (SECRET_KEY.test(key) || value === undefined) continue;
    if (typeof value === "string") out[key] = value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
    else if (typeof value === "number" || typeof value === "boolean" || value === null) out[key] = value;
    else if (Array.isArray(value)) out[key] = value.filter((v) => typeof v === "string" || typeof v === "number").slice(0, 20);
  }
  return out;
}

// Shown first, since they say what the event was about.
const LEAD_KEYS = ["name", "title", "email", "role"];

/** A one-line readable summary of an event's details, e.g. "name: Ada · role: MEMBER → ADMIN". */
export function describeMeta(meta: Record<string, unknown>): string {
  const keys = Object.keys(meta);
  const ordered = [...LEAD_KEYS.filter((k) => keys.includes(k)), ...keys.filter((k) => !LEAD_KEYS.includes(k))];
  return ordered
    .map((k) => {
      const v = meta[k];
      const text = Array.isArray(v) ? (v.length === 0 ? "none" : v.join(", ")) : String(v);
      return `${k}: ${text}`;
    })
    .join(" · ");
}
