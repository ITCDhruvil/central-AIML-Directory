import type { Scope } from "@/lib/auth/permissions";

// Project (and idea) teams. Stored in the ItemShare table; `access` holds the member's role.
// Membership widens what a user can REACH. What they may DO still depends on their own permissions.

export const MEMBER_ROLES = ["OWNER", "EDIT", "VIEW"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

const LABELS: Record<MemberRole, string> = { OWNER: "Owner", EDIT: "Contributor", VIEW: "Viewer" };

export function memberRoleLabel(role: string): string {
  return LABELS[role as MemberRole] ?? role;
}

export const MEMBER_ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  OWNER: "Manages the project and its team; can delete it",
  EDIT: "Can edit the project and its documents",
  VIEW: "Can view the project, read-only",
};

/** Which member roles count for an action: everyone for viewing, Owners and Contributors for changes, Owners only for deleting. */
export function accessesForAction(action: string): MemberRole[] {
  if (action === "view") return ["OWNER", "EDIT", "VIEW"];
  if (action === "delete") return ["OWNER"];
  return ["OWNER", "EDIT"];
}

export type TeamMember = { userId: string; role: MemberRole };

/** Validates a full team replacement: a list of { userId, role } with no duplicates and, if not empty, at least one Owner. */
export function validateTeam(input: unknown): { ok: true; members: TeamMember[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "members must be a list." };
  const seen = new Set<string>();
  const members: TeamMember[] = [];
  for (const raw of input) {
    const entry = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    const userId = typeof entry.userId === "string" ? entry.userId.trim() : "";
    const role = entry.role;
    if (!userId) return { ok: false, error: "Every member needs a user." };
    if (typeof role !== "string" || !(MEMBER_ROLES as readonly string[]).includes(role)) {
      return { ok: false, error: "Each member's role must be Owner, Contributor or Viewer." };
    }
    if (seen.has(userId)) return { ok: false, error: "A person can only be on the team once." };
    seen.add(userId);
    members.push({ userId, role: role as MemberRole });
  }
  if (members.length > 0 && !members.some((m) => m.role === "OWNER")) {
    return { ok: false, error: "A team needs at least one Owner." };
  }
  return { ok: true, members };
}

/** People who can change a project's team: anyone who may edit all projects, or an Owner of this one (who may edit it). */
export function canManageTeam({ editScope, isOwnerMember }: { editScope: Scope; isOwnerMember: boolean }): boolean {
  if (editScope === "ALL") return true;
  return editScope === "OWN" && isOwnerMember;
}
