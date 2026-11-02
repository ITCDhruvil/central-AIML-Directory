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

export const MAX_MANUAL_DOCUMENT_TITLE_LENGTH = 200;
export const MAX_MANUAL_DOCUMENT_CONTENT_LENGTH = 200_000; // ~200KB — generous for hand-written Markdown notes

export const DOCUMENT_SOURCES = ["github", "generated", "manual"] as const;
export type DocumentSource = (typeof DOCUMENT_SOURCES)[number];

/**
 * Source of a file a person uploaded (PDF, image, ...). Deliberately not in DOCUMENT_SOURCES: that list validates
 * documents arriving in a project-create body, which must never be able to claim an upload that has no file behind it.
 */
export const UPLOAD_SOURCE = "upload";

/** Facts about an uploaded file; the bytes are only ever read by the download route. */
export interface DocumentFileInfo {
  name: string;
  size: number;
  contentType: string;
}

export interface Documentation {
  id: string;
  projectId: string;
  title: string;
  category: DocumentCategory;
  filePath: string;
  content: string;
  source: string;
  generatedFromContentHash: string | null;
  /** Set only for uploaded files. */
  file?: DocumentFileInfo | null;
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
