import { can, scopeFor, type PermissionSet } from "@/lib/auth/permissions";
import { RESOURCE_LABELS } from "@/lib/auth/permissionLabels";
import type { ToolDefinition } from "@/lib/ai/chatTypes";

type Requirement = {
  /** Every [resource, action] pair the user must hold. */
  needs: [string, string][];
  /** Resources the user must hold with ALL scope (directory-wide features such as insights). */
  full?: string[];
};

const NONE: Requirement = { needs: [] };
const INSIGHTS_VIEW: Requirement = { needs: [["insights", "view"]], full: ["insights"] };

/**
 * Permission each chatbot tool needs. Enforced twice: tools the user can't use are hidden from
 * the model, and each handler is guarded again at call time. Tools with no entry here are unknown
 * and denied, so adding a tool without a requirement fails closed.
 */
export const TOOL_REQUIREMENTS: Record<string, Requirement> = {
  search_workspace: NONE, // filters each kind by the user's own view permission internally
  get_dashboard: NONE, // same
  set_appearance: NONE,
  open_page: NONE,

  list_projects: { needs: [["projects", "view"]] },
  get_project: { needs: [["projects", "view"]] },
  list_activity: { needs: [["projects", "view"]] },
  create_project: { needs: [["projects", "create"]] },
  update_project: { needs: [["projects", "edit"]] },
  delete_project: { needs: [["projects", "delete"]] },
  draft_project_from_github: { needs: [["projects", "create"], ["ai_github_autofill", "use"]] },

  list_ideas: { needs: [["ideas", "view"]] },
  get_idea: { needs: [["ideas", "view"]] },
  create_idea: { needs: [["ideas", "create"]] },
  update_idea: { needs: [["ideas", "edit"]] },
  promote_idea: { needs: [["ideas", "edit"], ["projects", "create"]] },
  delete_idea: { needs: [["ideas", "delete"]] },

  list_documents: { needs: [["documents", "view"]] },
  get_document: { needs: [["documents", "view"]] },

  list_insights: INSIGHTS_VIEW,
  get_insight: INSIGHTS_VIEW,
  save_insight_as_idea: { needs: [["insights", "view"], ["ideas", "create"]], full: ["insights"] },
  generate_insights: { needs: [["insights", "create"], ["ai_insights", "use"]], full: ["insights"] },

  list_owners: { needs: [["owners", "view"]] },

  // Project teams: reading needs view access; changing a team needs edit access (and being an Owner, checked server-side).
  get_project_team: { needs: [["projects", "view"]] },
  set_project_member: { needs: [["projects", "edit"]] },
  remove_project_member: { needs: [["projects", "edit"]] },

  // User management: each tool needs the matching users:* permission. Role/escalation limits are enforced again server-side.
  list_users: { needs: [["users", "view"]] },
  get_user: { needs: [["users", "view"]] },
  get_role_permissions: { needs: [["users", "view"]] },
  create_user: { needs: [["users", "create"]] },
  update_user: { needs: [["users", "edit"]] },
  reset_user_password: { needs: [["users", "edit"]] },
  set_user_permissions: { needs: [["users", "edit"]] },
  link_user_owners: { needs: [["users", "edit"]] },
  set_role_permissions: { needs: [["users", "edit"]] },
  delete_user: { needs: [["users", "delete"]] },
};

/** Plain-language list of what a tool needs, e.g. "permission to delete projects". Used in denial messages. */
export function describeRequirement(name: string): string {
  const req = TOOL_REQUIREMENTS[name];
  if (!req) return "something this person doesn't have";
  const parts = req.needs.map(([resource, action]) => {
    const area = (RESOURCE_LABELS[resource] ?? resource).toLowerCase();
    return resource.startsWith("ai_") ? `access to ${area}` : `permission to ${action} ${area}`;
  });
  if (req.full?.length) parts.push("access to all projects (not just their own)");
  return parts.join(" and ");
}

export function toolAvailable(name: string, perms: PermissionSet): boolean {
  const req = TOOL_REQUIREMENTS[name];
  if (!req) return false;
  if (!req.needs.every(([resource, action]) => can(perms, resource, action))) return false;
  return (req.full ?? []).every((resource) => scopeFor(perms, resource, "view") === "ALL");
}

export function toolsFor(perms: PermissionSet, tools: ToolDefinition[]): ToolDefinition[] {
  return tools.filter((tool) => toolAvailable(tool.function.name, perms));
}
