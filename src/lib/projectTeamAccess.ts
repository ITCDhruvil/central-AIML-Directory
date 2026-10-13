import "server-only";
import { canManageTeam } from "@/lib/auth/membership";
import { scopeFor } from "@/lib/auth/permissions";
import { loadAccessScope } from "@/lib/auth/scopeLoader";
import type { AuthUser } from "@/lib/auth/types";
import { isTeamOwner } from "@/lib/projectTeam";
import type { Project } from "@/types/project";

/** May this user change the project's team? Wide editors always; otherwise an Owner of this project who can edit. */
export async function canManageProjectTeam(user: AuthUser, project: Project): Promise<boolean> {
  const editScope = scopeFor(user.permissions, "projects", "edit");
  if (editScope === "ALL") return true;
  if (editScope === "NONE") return false;
  const mine = await loadAccessScope(user, "OWN", "view");
  const names = mine.all ? [] : mine.ownerNames;
  return canManageTeam({
    editScope,
    isOwnerMember: await isTeamOwner("PROJECT", project.id, user, project.owner, names),
  });
}
