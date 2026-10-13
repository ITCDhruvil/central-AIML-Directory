import type { ProjectActivity as ProjectActivityRow, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ALL_ACCESS, andWhere, projectScopeWhere, type AccessScope } from "@/lib/auth/scope";
import { PROJECT_ACTIVITY_SEARCH_FIELDS, orContainsFields } from "@/lib/schemaSearch";
import type { ProjectActivity, ProjectActivityType } from "@/types/project";

type ActivityClient = Prisma.TransactionClient | typeof prisma;

export function toProjectActivity(row: ProjectActivityRow): ProjectActivity {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type as ProjectActivityType,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Persists one activity row. Call only after the related write has succeeded (or inside the same transaction). */
export async function recordProjectActivity(
  client: ActivityClient,
  projectId: string,
  type: ProjectActivityType,
  title: string,
): Promise<void> {
  await client.projectActivity.create({
    data: { projectId, type, title },
  });
}

export interface ActivityFilters {
  q?: string;
  projectId?: string;
}

export type ProjectActivityWithProject = ProjectActivity & { projectName: string };

export function buildActivityWhere(filters: ActivityFilters) {
  const clauses: Record<string, unknown>[] = [];

  if (filters.q?.trim()) {
    clauses.push({ OR: orContainsFields(PROJECT_ACTIVITY_SEARCH_FIELDS, filters.q) });
  }
  if (filters.projectId) clauses.push({ projectId: filters.projectId });

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { AND: clauses };
}

export async function listRecentProjectActivities(
  projectId: string,
  limit = 5,
): Promise<ProjectActivity[]> {
  const rows = await prisma.projectActivity.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toProjectActivity);
}

export async function searchProjectActivities(
  filters: ActivityFilters = {},
  limit = 30,
  access: AccessScope = ALL_ACCESS,
): Promise<ProjectActivityWithProject[]> {
  const rows = await prisma.projectActivity.findMany({
    where: andWhere(buildActivityWhere(filters), access.all ? {} : { project: projectScopeWhere(access) }),
    include: { project: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((row) => ({ ...toProjectActivity(row), projectName: row.project.name }));
}

/** Stable compare for deployment URL arrays — order-insensitive for "did they change?". */
export function deploymentUrlsChanged(before: string[], after: string[]): boolean {
  if (before.length !== after.length) return true;
  const a = [...before].map((u) => u.trim()).sort();
  const b = [...after].map((u) => u.trim()).sort();
  return a.some((url, i) => url !== b[i]);
}
