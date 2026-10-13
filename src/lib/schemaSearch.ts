/** Prisma `contains` + case-insensitive — works on text and JSON-encoded string columns. */
export function containsInsensitive(q: string) {
  return { contains: q, mode: "insensitive" as const };
}

/** One `{ field: contains }` clause per column. Blank queries yield []. */
export function orContainsFields(fields: readonly string[], q: string) {
  const trimmed = q.trim();
  if (!trimmed) return [];
  return fields.map((field) => ({ [field]: containsInsensitive(trimmed) }));
}

/** Every searchable Project column (JSON arrays are stored as text). */
export const PROJECT_SEARCH_FIELDS = [
  "name",
  "slug",
  "description",
  "type",
  "status",
  "stage",
  "owner",
  "githubUrl",
  "githubOwner",
  "githubRepo",
  "defaultBranch",
  "technologies",
  "tags",
  "deploymentUrls",
] as const;

export const DOCUMENT_SEARCH_FIELDS = ["title", "category", "filePath", "content", "source"] as const;

export const PROJECT_ACTIVITY_SEARCH_FIELDS = ["type", "title"] as const;

export const IDEA_SEARCH_FIELDS = [
  "name",
  "slug",
  "description",
  "status",
  "owner",
  "technologies",
  "tags",
  "promotedProjectId",
] as const;

export const INSIGHT_SEARCH_FIELDS = [
  "scope",
  "type",
  "title",
  "reasoning",
  "suggestedTool",
  "relatedProjectName",
  "sourceUrls",
  "lastChange",
] as const;
