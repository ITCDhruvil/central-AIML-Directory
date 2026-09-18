import type { Idea } from "@/types/idea";
import type { Project } from "@/types/project";
import { buildSnippet, containsAllTokens, tokenize } from "@/lib/search/matcher";
import type {
  DocumentationSearchResult,
  IdeaSearchResult,
  ProjectSearchResult,
  SearchResponse,
  SearchableDocument,
} from "@/lib/search/types";

/** Deterministic priority — lower wins. Matches the Phase 8 spec's suggested ranking. */
export const RANK = {
  PROJECT_NAME_EXACT: 0,
  PROJECT_NAME_PARTIAL: 1,
  DOC_TITLE: 2,
  TECHNOLOGY: 3,
  DOC_CONTENT: 4,
  DESCRIPTION_OR_CATEGORY: 5,
} as const;

export const MAX_PROJECT_RESULTS = 8;
export const MAX_IDEA_RESULTS = 8;
export const MAX_DOCUMENTATION_RESULTS = 12;

function rankProject(project: Project, tokens: string[], trimmedQuery: string): number | null {
  if (project.name.toLowerCase() === trimmedQuery.toLowerCase()) return RANK.PROJECT_NAME_EXACT;
  if (containsAllTokens(project.name, tokens)) return RANK.PROJECT_NAME_PARTIAL;
  if (project.technologies.some((t) => containsAllTokens(t.name, tokens))) return RANK.TECHNOLOGY;
  if (project.owner && containsAllTokens(project.owner, tokens)) return RANK.DESCRIPTION_OR_CATEGORY;
  if (project.tags.some((t) => containsAllTokens(t, tokens))) return RANK.DESCRIPTION_OR_CATEGORY;
  if (project.description && containsAllTokens(project.description, tokens)) return RANK.DESCRIPTION_OR_CATEGORY;
  return null;
}

function rankIdea(idea: Idea, tokens: string[], trimmedQuery: string): number | null {
  if (idea.name.toLowerCase() === trimmedQuery.toLowerCase()) return RANK.PROJECT_NAME_EXACT;
  if (containsAllTokens(idea.name, tokens)) return RANK.PROJECT_NAME_PARTIAL;
  if (idea.technologies.some((t) => containsAllTokens(t.name, tokens))) return RANK.TECHNOLOGY;
  if (idea.owner && containsAllTokens(idea.owner, tokens)) return RANK.DESCRIPTION_OR_CATEGORY;
  if (idea.tags.some((t) => containsAllTokens(t, tokens))) return RANK.DESCRIPTION_OR_CATEGORY;
  if (idea.description && containsAllTokens(idea.description, tokens)) return RANK.DESCRIPTION_OR_CATEGORY;
  return null;
}

function rankDocumentation(
  doc: SearchableDocument,
  tokens: string[],
): { rank: number; matchedBy: DocumentationSearchResult["matchedBy"] } | null {
  if (containsAllTokens(doc.title, tokens)) return { rank: RANK.DOC_TITLE, matchedBy: "title" };
  if (containsAllTokens(doc.content, tokens)) return { rank: RANK.DOC_CONTENT, matchedBy: "content" };
  if (containsAllTokens(doc.category, tokens)) return { rank: RANK.DESCRIPTION_OR_CATEGORY, matchedBy: "category" };
  return null;
}

/**
 * Pure, deterministic global search over already-fetched projects and
 * documentation — no DB/network calls, no LLM. Matching is case-insensitive,
 * whitespace-tolerant, multi-word (all words must appear, any order, any
 * field) substring matching. Safe against SQL injection by construction:
 * everything here is plain string comparison, never interpolated into a query.
 */
export function searchPortfolio(
  query: string,
  projects: Project[],
  documents: SearchableDocument[],
  ideas: Idea[] = [],
): SearchResponse {
  const trimmedQuery = query.trim();
  const tokens = tokenize(query);

  if (tokens.length === 0) {
    return { query: trimmedQuery, projects: [], ideas: [], documentation: [] };
  }

  const projectResults: ProjectSearchResult[] = [];
  for (const project of projects) {
    const rank = rankProject(project, tokens, trimmedQuery);
    if (rank !== null) projectResults.push({ type: "project", rank, project });
  }

  const ideaResults: IdeaSearchResult[] = [];
  for (const idea of ideas) {
    const rank = rankIdea(idea, tokens, trimmedQuery);
    if (rank !== null) ideaResults.push({ type: "idea", rank, idea });
  }

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const documentationResults: DocumentationSearchResult[] = [];
  for (const doc of documents) {
    const match = rankDocumentation(doc, tokens);
    if (!match) continue;
    const project = projectById.get(doc.projectId);
    if (!project) continue;

    documentationResults.push({
      type: "documentation",
      rank: match.rank,
      matchedBy: match.matchedBy,
      project: { id: project.id, name: project.name, slug: project.slug },
      document: { id: doc.id, title: doc.title, category: doc.category },
      snippet: match.matchedBy === "content" ? buildSnippet(doc.content, tokens) : null,
    });
  }

  projectResults.sort((a, b) => a.rank - b.rank || a.project.name.localeCompare(b.project.name));
  ideaResults.sort((a, b) => a.rank - b.rank || a.idea.name.localeCompare(b.idea.name));
  documentationResults.sort((a, b) => a.rank - b.rank || a.document.title.localeCompare(b.document.title));

  return {
    query: trimmedQuery,
    projects: projectResults.slice(0, MAX_PROJECT_RESULTS),
    ideas: ideaResults.slice(0, MAX_IDEA_RESULTS),
    documentation: documentationResults.slice(0, MAX_DOCUMENTATION_RESULTS),
  };
}
