import type { Project } from "@/types/project";

// Pure helpers for the projects table: which columns exist, which are shown, sorting, and the owner filter.

export const COLUMN_IDS = [
  "name",
  "technologies",
  "type",
  "status",
  "stage",
  "owner",
  "tags",
  "github",
  "deployment",
  "branch",
  "updated",
  "created",
  "synced",
] as const;

export type ColumnId = (typeof COLUMN_IDS)[number];

export const COLUMN_META: Record<ColumnId, { label: string; description: string }> = {
  name: { label: "Project", description: "Name and short description" },
  technologies: { label: "Technologies", description: "Languages, frameworks and tools" },
  type: { label: "Type", description: "Project, POC, experiment…" },
  status: { label: "Status", description: "Active, completed, on hold…" },
  stage: { label: "Stage", description: "Idea, development, production…" },
  owner: { label: "Owner", description: "Who is responsible" },
  tags: { label: "Tags", description: "Free-form labels" },
  github: { label: "GitHub", description: "Linked repository" },
  deployment: { label: "Deployment", description: "Live or internal URL" },
  branch: { label: "Branch", description: "Default branch" },
  updated: { label: "Updated", description: "Last change" },
  created: { label: "Created", description: "When it was added" },
  synced: { label: "Last synced", description: "Last GitHub sync" },
};

export const DEFAULT_COLUMNS: ColumnId[] = ["name", "technologies", "type", "status", "updated"];

const isColumn = (value: unknown): value is ColumnId => (COLUMN_IDS as readonly string[]).includes(value as string);

/** Cleans a stored column list: known ids only, no duplicates, "name" always first. Falls back to the defaults. */
export function normalizeColumns(raw: unknown): ColumnId[] {
  if (!Array.isArray(raw)) return [...DEFAULT_COLUMNS];
  const seen = new Set<ColumnId>(["name"]);
  const out: ColumnId[] = ["name"];
  for (const value of raw) {
    if (isColumn(value) && !seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

/** Columns that exist for projects but aren't shown yet. */
export function availableColumns(shown: ColumnId[]): ColumnId[] {
  return COLUMN_IDS.filter((id) => !shown.includes(id));
}

/** Sortable value for a column; null/undefined means "no value" and sorts last in either direction. */
function sortValue(p: Project, column: ColumnId): string | number | null {
  switch (column) {
    case "name":
      return p.name.toLowerCase();
    case "technologies":
      return p.technologies.length || null;
    case "type":
      return p.type;
    case "status":
      return p.status;
    case "stage":
      return p.stage;
    case "owner": {
      const lead = p.team?.find((m) => m.role === "OWNER")?.name ?? p.owner;
      return lead?.trim() ? lead.trim().toLowerCase() : null;
    }
    case "tags":
      return p.tags.length || null;
    case "github":
      return p.githubRepo ? `${p.githubOwner ?? ""}/${p.githubRepo}`.toLowerCase() : null;
    case "deployment":
      return p.deploymentUrls[0]?.toLowerCase() ?? null;
    case "branch":
      return p.defaultBranch?.toLowerCase() ?? null;
    case "updated":
      return p.updatedAt;
    case "created":
      return p.createdAt;
    case "synced":
      return p.lastSyncedAt;
  }
}

/** How many of the given projects have a value for the column (used to show what a column would contain). */
export function columnDataCount(projects: Project[], column: ColumnId): number {
  return projects.filter((p) => sortValue(p, column) !== null).length;
}

export type SortState = { column: ColumnId; dir: "asc" | "desc" };

export function sortProjectsBy(projects: Project[], sort: SortState): Project[] {
  const factor = sort.dir === "asc" ? 1 : -1;
  return [...projects].sort((a, b) => {
    const av = sortValue(a, sort.column);
    const bv = sortValue(b, sort.column);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
    return String(av).localeCompare(String(bv)) * factor;
  });
}

/** The sort presets offered in the toolbar dropdown, expressed as table sort state. */
const PRESETS: Record<string, SortState> = {
  "updated-desc": { column: "updated", dir: "desc" },
  "created-desc": { column: "created", dir: "desc" },
  "name-asc": { column: "name", dir: "asc" },
  "name-desc": { column: "name", dir: "desc" },
  "last-synced": { column: "synced", dir: "desc" },
};

export function presetToSort(preset: string): SortState {
  return PRESETS[preset] ?? PRESETS["updated-desc"];
}

export function sortToPreset(sort: SortState): string | null {
  return Object.entries(PRESETS).find(([, s]) => s.column === sort.column && s.dir === sort.dir)?.[0] ?? null;
}

/**
 * Person filter: "me" = projects the signed-in user is on (team member, or matching the free-text owner),
 * "" = everyone's, anything else = projects that person is on or is named as owner of.
 */
export function matchesOwnerFilter(
  project: Project,
  filter: string,
  myOwnerNames: string[],
  myUserId?: string,
): boolean {
  if (filter === "") return true;
  const owner = project.owner?.trim().toLowerCase();
  if (filter === "me") {
    if (myUserId && project.team?.some((m) => m.userId === myUserId)) return true;
    return Boolean(owner) && myOwnerNames.some((n) => n.trim().toLowerCase() === owner);
  }
  const wanted = filter.trim().toLowerCase();
  if (owner === wanted) return true;
  return Boolean(project.team?.some((m) => m.name.trim().toLowerCase() === wanted));
}

/** Distinct people in the data (team members and free-text owners), sorted case-insensitively. */
export function ownerOptions(projects: Project[]): string[] {
  const seen = new Map<string, string>();
  const add = (raw: string | null | undefined) => {
    const name = raw?.trim();
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  };
  for (const p of projects) {
    add(p.owner);
    for (const m of p.team ?? []) add(m.name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
