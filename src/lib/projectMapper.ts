import type { Project as ProjectRow } from "@/generated/prisma/client";
import type { Project } from "@/types/project";
import { TECHNOLOGY_CATEGORIES, CONFIDENCE_LEVELS, type Technology } from "@/types/technology";

export function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Parses the `technologies` column. Accepts both the structured Phase 4 shape
 * and the plain string[] shape saved by Phase 1-3 projects — existing rows
 * must keep loading correctly. A bare string is upgraded into a minimal
 * Technology entry (category OTHER, confidence MEDIUM, no evidence).
 */
export function parseTechnologies(value: string): Technology[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const result: Technology[] = [];
  for (const item of parsed) {
    if (typeof item === "string") {
      const name = item.trim();
      if (name) result.push({ name, category: "OTHER", evidence: [], confidence: "MEDIUM" });
      continue;
    }
    if (typeof item === "object" && item !== null) {
      const obj = item as Record<string, unknown>;
      const name = typeof obj.name === "string" ? obj.name.trim() : "";
      if (!name) continue;
      const category = TECHNOLOGY_CATEGORIES.includes(obj.category as Technology["category"])
        ? (obj.category as Technology["category"])
        : "OTHER";
      const confidence = CONFIDENCE_LEVELS.includes(obj.confidence as Technology["confidence"])
        ? (obj.confidence as Technology["confidence"])
        : "MEDIUM";
      const evidence = Array.isArray(obj.evidence) ? obj.evidence.filter((e): e is string => typeof e === "string") : [];
      result.push({ name, category, evidence, confidence });
    }
  }
  return result;
}

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    type: row.type as Project["type"],
    status: row.status as Project["status"],
    stage: (row.stage as Project["stage"]) ?? null,
    owner: row.owner,
    githubUrl: row.githubUrl,
    githubOwner: row.githubOwner,
    githubRepo: row.githubRepo,
    defaultBranch: row.defaultBranch,
    technologies: parseTechnologies(row.technologies),
    tags: parseStringArray(row.tags),
    deploymentUrls: parseStringArray(row.deploymentUrls),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
  };
}
