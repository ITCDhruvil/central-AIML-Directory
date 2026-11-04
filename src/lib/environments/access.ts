import "server-only";
import { authorizeUser } from "@/lib/auth/access";
import { apiAuthorize, type ApiAuth } from "@/lib/auth/dal";
import { loadAccessScope } from "@/lib/auth/scopeLoader";
import type { AuthUser } from "@/lib/auth/types";
import { getProjectById } from "@/lib/projects";

/** Can this user edit the project (and so manage its environments, links and test accounts)? */
export async function canEditEnvironments(user: AuthUser, projectId: string): Promise<boolean> {
  const result = authorizeUser(user, "projects", "edit");
  if (!result.ok) return false;
  const access = await loadAccessScope(user, result.scope, "edit");
  return Boolean(await getProjectById(projectId, access));
}

/**
 * Route-handler gate: "view" needs the project to be visible, "edit" needs the same right as editing the project.
 * Returns the auth result plus a 404 when the project is not accessible.
 */
export async function authorizeProject(
  projectId: string,
  need: "view" | "edit",
): Promise<(Extract<ApiAuth, { ok: true }> & { canEdit: boolean }) | { ok: false; response: Response }> {
  const auth = await apiAuthorize("projects", need);
  if (!auth.ok) return auth;
  const project = await getProjectById(projectId, auth.access);
  if (!project) return { ok: false, response: Response.json({ error: "Project not found" }, { status: 404 }) };
  const canEdit = need === "edit" ? true : await canEditEnvironments(auth.user, projectId);
  return { ...auth, canEdit };
}
