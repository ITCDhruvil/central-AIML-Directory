import "server-only";
import type { ChatbotContext } from "@/lib/ai/chatbotContext";
import { MEMBER_ROLES, memberRoleLabel, type MemberRole } from "@/lib/auth/membership";
import { getProjectById, listProjects } from "@/lib/projects";
import { TeamError, getTeam, searchActiveUsers, setTeam, type TeamEntry } from "@/lib/projectTeam";
import { canManageProjectTeam } from "@/lib/projectTeamAccess";
import type { Project } from "@/types/project";

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function describe(team: TeamEntry[]) {
  return team.map((m) => ({ name: m.name, email: m.email, role: memberRoleLabel(m.role) }));
}

/** Team tool handlers, bound to the signed-in user. The same rules as the Team card apply (see canManageProjectTeam). */
export function buildTeamHandlers(ctx: ChatbotContext): Record<string, Handler> {
  const { user, view, edit } = ctx;

  async function findProject(ref: string, access: typeof view.projects): Promise<Project | { error: string }> {
    if (!ref) return { error: "project is required — ask which project." };
    const byId = await getProjectById(ref, access);
    if (byId) return byId;
    const matches = await listProjects({ q: ref }, access);
    const exact = matches.filter((p) => p.name.toLowerCase() === ref.toLowerCase());
    const pool = exact.length > 0 ? exact : matches;
    if (pool.length === 0) return { error: `No project matching "${ref}" that you can access.` };
    if (pool.length > 1) {
      return { error: `Several projects match "${ref}" — ask which one: ${pool.slice(0, 6).map((p) => p.name).join(", ")}.` };
    }
    return pool[0];
  }

  async function findPerson(ref: string): Promise<{ id: string; name: string; email: string } | { error: string }> {
    if (!ref) return { error: "person is required — ask who." };
    const matches = await searchActiveUsers(ref, 6);
    const exact = matches.filter((u) => u.email.toLowerCase() === ref.toLowerCase() || u.name.toLowerCase() === ref.toLowerCase());
    const pool = exact.length > 0 ? exact : matches;
    if (pool.length === 0) return { error: `No active user matches "${ref}". Only people with an account can be on a team.` };
    if (pool.length > 1) {
      return { error: `Several people match "${ref}" — ask which one: ${pool.map((u) => `${u.name} <${u.email}>`).join(", ")}.` };
    }
    return pool[0];
  }

  return {
    get_project_team: async (args) => {
      const project = await findProject(str(args.project), view.projects);
      if ("error" in project) return project;
      const team = await getTeam("PROJECT", project.id);
      return {
        project: project.name,
        team: describe(team),
        legacyOwner: project.owner,
        note: team.length === 0 ? "No team set up yet; the free-text owner is only a label." : undefined,
      };
    },

    set_project_member: async (args) => {
      const role = str(args.role).toUpperCase();
      if (!(MEMBER_ROLES as readonly string[]).includes(role)) {
        return { error: "role must be OWNER, EDIT (Contributor) or VIEW (Viewer) — ask which one." };
      }
      const project = await findProject(str(args.project), edit.projects);
      if ("error" in project) return project;
      if (!(await canManageProjectTeam(user, project))) {
        return { error: "Only the project's owners (or a manager) can change its team.", note: "Explain this; don't retry." };
      }
      const person = await findPerson(str(args.person));
      if ("error" in person) return person;

      const current = await getTeam("PROJECT", project.id);
      const next = [
        ...current.filter((m) => m.userId !== person.id).map((m) => ({ userId: m.userId, role: m.role })),
        { userId: person.id, role: role as MemberRole },
      ];
      // A project's very first member has to be an Owner, otherwise the team is invalid.
      if (current.length === 0 && role !== "OWNER") next[0].role = "OWNER";
      try {
        const team = await setTeam("PROJECT", project.id, next, user.id);
        return { updated: true, project: project.name, team: describe(team) };
      } catch (error) {
        if (error instanceof TeamError) return { error: error.message };
        throw error;
      }
    },

    remove_project_member: async (args) => {
      const project = await findProject(str(args.project), edit.projects);
      if ("error" in project) return project;
      if (!(await canManageProjectTeam(user, project))) {
        return { error: "Only the project's owners (or a manager) can change its team.", note: "Explain this; don't retry." };
      }
      const person = await findPerson(str(args.person));
      if ("error" in person) return person;

      const current = await getTeam("PROJECT", project.id);
      if (!current.some((m) => m.userId === person.id)) return { error: `${person.name} isn't on this project's team.` };
      try {
        const team = await setTeam(
          "PROJECT",
          project.id,
          current.filter((m) => m.userId !== person.id).map((m) => ({ userId: m.userId, role: m.role })),
          user.id,
        );
        return { removed: true, project: project.name, person: person.name, team: describe(team) };
      } catch (error) {
        if (error instanceof TeamError) return { error: error.message };
        throw error;
      }
    },
  };
}
