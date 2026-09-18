export const DOCUMENT_CATEGORIES = [
  "README",
  "SETUP",
  "ARCHITECTURE",
  "PRD",
  "PLAN",
  "AI_RULES",
  "DESIGN",
  "API",
  "NOTES",
  "OTHER",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** Categories offered when a user manually creates a document (README is a GitHub-discovery concept, not manual). */
export const MANUAL_DOCUMENT_CATEGORIES = DOCUMENT_CATEGORIES.filter((c) => c !== "README");

export const DOCUMENT_SOURCES = ["github", "generated", "manual"] as const;
export type DocumentSource = (typeof DOCUMENT_SOURCES)[number];

export interface Documentation {
  id: string;
  projectId: string;
  title: string;
  category: DocumentCategory;
  filePath: string;
  content: string;
  source: string;
  generatedFromContentHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentInput {
  title: string;
  category: DocumentCategory;
  filePath: string;
  content: string;
  source?: DocumentSource;
  /**
   * For source="generated" only: the pristine, pre-edit generated text.
   * The server hashes this (not `content`) so a later sync can tell whether
   * the user has since edited the saved content.
   */
  generatedFromContent?: string;
}
