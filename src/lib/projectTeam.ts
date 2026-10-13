import { prisma } from "@/lib/prisma";
import { validateTeam, type MemberRole, type TeamMember } from "@/lib/auth/membership";
import type { Project, ProjectTeamMember } from "@/types/project";

// Team membership for projects (and ideas), stored in ItemShare. No "server-only" import on purpose:
// the lib modules that call this are also imported by plain unit tests, and the prisma client is lazy.

export type EntityType = "PROJECT" | "IDEA";

export type TeamEntry = { userId: string; name: string; email: string; role: MemberRole };

export class TeamError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 = 400,
  ) {
    super(message);
  }
}

const ROLE_ORDER: Record<MemberRole, number> = { OWNER: 0, EDIT: 1, VIEW: 2 };

function sortTeam<T extends { role: MemberRole; name: string }>(team: T[]): T[] {
  return [...team].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name));
}

/** Teams for several entities in one query, keyed by entity id. Inactive users are left out. */
export async function getTeams(entityType: EntityType, ids: string[]): Promise<Map<string, TeamEntry[]>> {
  const out = new Map<string, TeamEntry[]>();
  if (ids.length === 0) return out;
  const rows = await prisma.itemShare.findMany({
    where: { entityType, entityId: { in: ids }, user: { active: true } },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  for (const row of rows) {
    const list = out.get(row.entityId) ?? [];
    list.push({ userId: row.user.id, name: row.user.name, email: row.user.email, role: row.access as MemberRole });
    out.set(row.entityId, list);
  }
  for (const [id, list] of out) out.set(id, sortTeam(list));
  return out;
}

/** Adds a `team` list to each project (names only — emails stay out of the list payload). */
export async function withTeams(projects: Project[]): Promise<Project[]> {
  const teams = await getTeams("PROJECT", projects.map((p) => p.id));
  return projects.map((p) => ({
    ...p,
    team: (teams.get(p.id) ?? []).map((m): ProjectTeamMember => ({ userId: m.userId, name: m.name, role: m.role })),
  }));
}

export async function getTeam(entityType: EntityType, entityId: string): Promise<TeamEntry[]> {
  return (await getTeams(entityType, [entityId])).get(entityId) ?? [];
}

/** Replaces the whole team. Every member must be an active user. Returns the stored team. */
export async function setTeam(entityType: EntityType, entityId: string, raw: unknown, actorId: string): Promise<TeamEntry[]> {
  const parsed = validateTeam(raw);
  if (!parsed.ok) throw new TeamError(parsed.error);
  const members: TeamMember[] = parsed.members;

  if (members.length > 0) {
    const found = await prisma.user.findMany({
      where: { id: { in: members.map((m) => m.userId) }, active: true },
      select: { id: true },
    });
    if (found.length !== members.length) throw new TeamError("Every team member must be an active user.");
  }

  await prisma.$transaction([
    prisma.itemShare.deleteMany({ where: { entityType, entityId } }),
    prisma.itemShare.createMany({
      data: members.map((m) => ({ entityType, entityId, userId: m.userId, access: m.role, grantedById: actorId })),
    }),
  ]);
  return getTeam(entityType, entityId);
}

/** The person who creates something becomes its Owner, unless they already have a role on it. */
export async function addCreatorAsOwner(entityType: EntityType, entityId: string, userId: string): Promise<void> {
  await prisma.itemShare.upsert({
    where: { entityType_entityId_userId: { entityType, entityId, userId } },
    create: { entityType, entityId, userId, access: "OWNER", grantedById: userId },
    update: {},
  });
}

export async function removeTeam(entityType: EntityType, entityId: string): Promise<void> {
  await prisma.itemShare.deleteMany({ where: { entityType, entityId } });
}

/** True when the user is an Owner member, or matches the project's legacy free-text owner name. */
export async function isTeamOwner(
  entityType: EntityType,
  entityId: string,
  user: { id: string },
  legacyOwner: string | null,
  myOwnerNames: string[],
): Promise<boolean> {
  const row = await prisma.itemShare.findFirst({
    where: { entityType, entityId, userId: user.id, access: "OWNER" },
    select: { id: true },
  });
  if (row) return true;
  const owner = legacyOwner?.trim().toLowerCase();
  return Boolean(owner) && myOwnerNames.some((n) => n.trim().toLowerCase() === owner);
}

/** Active users matching a name/email fragment, for the "add a team member" picker. */
export async function searchActiveUsers(q: string, limit = 8): Promise<{ id: string; name: string; email: string }[]> {
  const tokens = q.trim().split(/\s+/).filter(Boolean);
  return prisma.user.findMany({
    where: {
      active: true,
      AND: tokens.map((t) => ({
        OR: [{ name: { contains: t, mode: "insensitive" as const } }, { email: { contains: t, mode: "insensitive" as const } }],
      })),
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: limit,
  });
}
