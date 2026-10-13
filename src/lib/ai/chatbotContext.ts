import "server-only";
import { loadViewAccess, type ViewAccess } from "@/lib/auth/dal";
import { scopeFor } from "@/lib/auth/permissions";
import type { AccessScope } from "@/lib/auth/scope";
import { loadAccessScope } from "@/lib/auth/scopeLoader";
import type { PermissionSet, Role } from "@/lib/auth/permissions";
import { loadRoleMatrix } from "@/lib/auth/roleMatrix";
import type { AuthUser } from "@/lib/auth/types";

/** Everything a chatbot turn needs to act strictly within the signed-in user's permissions. */
export type ChatbotContext = {
  user: AuthUser;
  view: ViewAccess;
  edit: { projects: AccessScope; ideas: AccessScope };
  remove: { projects: AccessScope; ideas: AccessScope };
  /** Effective defaults per role, used to tell the model which roles this person may assign. */
  roleDefaults: Record<Role, PermissionSet>;
};

export async function buildChatbotContext(user: AuthUser): Promise<ChatbotContext> {
  const scoped = (resource: string, action: string) =>
    loadAccessScope(user, scopeFor(user.permissions, resource, action), action);

  const [view, editProjects, editIdeas, removeProjects, removeIdeas, roleDefaults] = await Promise.all([
    loadViewAccess(user),
    scoped("projects", "edit"),
    scoped("ideas", "edit"),
    scoped("projects", "delete"),
    scoped("ideas", "delete"),
    loadRoleMatrix(),
  ]);

  return {
    user,
    view,
    edit: { projects: editProjects, ideas: editIdeas },
    remove: { projects: removeProjects, ideas: removeIdeas },
    roleDefaults,
  };
}
