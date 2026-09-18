import type { Project } from "@/types/project";

export const SORT_OPTIONS = [
  "updated-desc",
  "created-desc",
  "name-asc",
  "name-desc",
  "last-synced",
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  "updated-desc": "Recently Updated",
  "created-desc": "Recently Created",
  "name-asc": "Name A-Z",
  "name-desc": "Name Z-A",
  "last-synced": "Last Synced",
};

/** Client-side GitHub-connected filtering — q (which also matches technology names)/type/status are already applied server-side. */
export function applyClientFilters(projects: Project[], filters: { githubConnectedOnly?: boolean }): Project[] {
  if (!filters.githubConnectedOnly) return projects;
  return projects.filter((p) => Boolean(p.githubUrl));
}

export function sortProjects(projects: Project[], sort: SortOption): Project[] {
  const copy = [...projects];

  switch (sort) {
    case "updated-desc":
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case "created-desc":
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "name-asc":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return copy.sort((a, b) => b.name.localeCompare(a.name));
    case "last-synced":
      return copy.sort((a, b) => {
        if (!a.lastSyncedAt && !b.lastSyncedAt) return 0;
        if (!a.lastSyncedAt) return 1;
        if (!b.lastSyncedAt) return -1;
        return b.lastSyncedAt.localeCompare(a.lastSyncedAt);
      });
    default:
      return copy;
  }
}
