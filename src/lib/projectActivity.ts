import type { ProjectActivity as ProjectActivityRow, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
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

/** Stable compare for deployment URL arrays — order-insensitive for "did they change?". */
export function deploymentUrlsChanged(before: string[], after: string[]): boolean {
  if (before.length !== after.length) return true;
  const a = [...before].map((u) => u.trim()).sort();
  const b = [...after].map((u) => u.trim()).sort();
  return a.some((url, i) => url !== b[i]);
}
