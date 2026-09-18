import type { DocumentCategory } from "@/types/documentation";
import type { Idea } from "@/types/idea";
import type { Project } from "@/types/project";

export interface SnippetSegment {
  text: string;
  highlighted: boolean;
}

export type DocumentMatchReason = "title" | "category" | "content";

export interface ProjectSearchResult {
  type: "project";
  rank: number;
  project: Project;
}

export interface IdeaSearchResult {
  type: "idea";
  rank: number;
  idea: Idea;
}

export interface DocumentationSearchResult {
  type: "documentation";
  rank: number;
  matchedBy: DocumentMatchReason;
  project: { id: string; name: string; slug: string };
  document: { id: string; title: string; category: DocumentCategory };
  /** Only present when matchedBy === "content" — plain-text segments, safe to render directly. */
  snippet: SnippetSegment[] | null;
}

export interface SearchResponse {
  query: string;
  projects: ProjectSearchResult[];
  ideas: IdeaSearchResult[];
  documentation: DocumentationSearchResult[];
}

/** Minimal shape the search module needs from a Documentation row — never the full model. */
export interface SearchableDocument {
  id: string;
  projectId: string;
  title: string;
  category: DocumentCategory;
  content: string;
}
