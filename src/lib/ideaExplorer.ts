// Pure helpers for the Ideas page: search, filters and sorting, kept apart from the UI so they can be tested.
import type { Idea, IdeaStatus } from "@/types/idea";

export type IdeaColumn =
  "name" | "status" | "owner" | "technologies" | "tags" | "updated";
export type SortDir = "asc" | "desc";
export type IdeaSort = { column: IdeaColumn; dir: SortDir };

export const DEFAULT_IDEA_SORT: IdeaSort = { column: "updated", dir: "desc" };

/** The sort choices offered in the filter menu (the table headers can sort by any column too). */
export const IDEA_SORT_PRESETS: Record<
  string,
  { label: string; sort: IdeaSort }
> = {
  "updated-desc": {
    label: "Recently updated",
    sort: { column: "updated", dir: "desc" },
  },
  "updated-asc": {
    label: "Oldest updated",
    sort: { column: "updated", dir: "asc" },
  },
  "name-asc": { label: "Name A–Z", sort: { column: "name", dir: "asc" } },
  "name-desc": { label: "Name Z–A", sort: { column: "name", dir: "desc" } },
};

export function ideaSortToPreset(sort: IdeaSort): string | null {
  return (
    Object.entries(IDEA_SORT_PRESETS).find(
      ([, p]) => p.sort.column === sort.column && p.sort.dir === sort.dir,
    )?.[0] ?? null
  );
}

/** Clicking a header sorts by it ascending; clicking the active one flips the direction. Dates start newest-first. */
export function toggleIdeaSort(
  current: IdeaSort,
  column: IdeaColumn,
): IdeaSort {
  if (current.column === column)
    return { column, dir: current.dir === "asc" ? "desc" : "asc" };
  return { column, dir: column === "updated" ? "desc" : "asc" };
}

const text = (v: string | null | undefined) => (v ?? "").toLowerCase();

/** Every searchable field, so a search for a tag, a technology or an owner finds the idea. */
export function ideaMatchesQuery(idea: Idea, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    idea.name,
    idea.description,
    idea.owner,
    idea.status.replace("_", " "),
    ...idea.tags,
    ...idea.technologies.map((t) => t.name),
  ]
    .map(text)
    .join("\n");
  return haystack.includes(q);
}

export type IdeaFilters = {
  query: string;
  statuses: IdeaStatus[];
  owner: string;
};

export function filterIdeas(ideas: Idea[], f: IdeaFilters): Idea[] {
  const owner = f.owner.trim().toLowerCase();
  return ideas.filter(
    (idea) =>
      ideaMatchesQuery(idea, f.query) &&
      (f.statuses.length === 0 || f.statuses.includes(idea.status)) &&
      (owner === "" || text(idea.owner).trim() === owner),
  );
}

/** Distinct owner names, case-insensitively, sorted. */
export function ideaOwnerOptions(ideas: Idea[]): string[] {
  const seen = new Map<string, string>();
  for (const idea of ideas) {
    const name = idea.owner?.trim();
    if (name && !seen.has(name.toLowerCase()))
      seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

export function sortIdeas(ideas: Idea[], sort: IdeaSort): Idea[] {
  const dir = sort.dir === "asc" ? 1 : -1;
  const key = (idea: Idea): string | number => {
    switch (sort.column) {
      case "name":
        return text(idea.name);
      case "status":
        return idea.status;
      case "owner":
        return text(idea.owner);
      case "technologies":
        return idea.technologies.length;
      case "tags":
        return idea.tags.length;
      case "updated":
        return Date.parse(idea.updatedAt) || 0;
    }
  };
  return [...ideas].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    // Blank owners sort last in either direction, so "A–Z" doesn't start with a wall of empty cells.
    if (sort.column === "owner" && (x === "" || y === "") && x !== y)
      return x === "" ? 1 : -1;
    const cmp =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y));
    return cmp !== 0 ? cmp * dir : text(a.name).localeCompare(text(b.name));
  });
}
