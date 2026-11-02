import { classifyDocument, generateTitle } from "@/lib/github/documents";
import {
  MAX_MANUAL_DOCUMENT_CONTENT_LENGTH,
  MAX_MANUAL_DOCUMENT_TITLE_LENGTH,
  type DocumentCategory,
} from "@/types/documentation";

/** Plain-text formats a person can upload; the content is stored as the document's Markdown. */
export const UPLOAD_EXTENSIONS = [".md", ".markdown", ".mdx", ".txt"] as const;
export const UPLOAD_ACCEPT = UPLOAD_EXTENSIONS.join(",");

export type UploadPayload = { title: string; category: DocumentCategory; content: string };

export function isUploadableFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return UPLOAD_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Turns an uploaded file's name and text into a manual-document payload, or an error message the UI can show.
 * Title comes from the file name; category from well-known names (e.g. PRD.md) and otherwise Notes.
 */
export function prepareUpload(fileName: string, text: string): UploadPayload | { error: string } {
  if (!isUploadableFile(fileName)) {
    return { error: `${fileName}: only ${UPLOAD_EXTENSIONS.join(", ")} files can be uploaded.` };
  }
  // A BOM would otherwise show up as a stray character at the start of the document.
  const content = text.replace(/^﻿/, "");
  if (!content.trim()) return { error: `${fileName}: the file is empty.` };
  if (content.length > MAX_MANUAL_DOCUMENT_CONTENT_LENGTH) {
    return { error: `${fileName}: too large (limit is ${Math.round(MAX_MANUAL_DOCUMENT_CONTENT_LENGTH / 1000)} KB of text).` };
  }

  const title = generateTitle(fileName).slice(0, MAX_MANUAL_DOCUMENT_TITLE_LENGTH) || "Document";
  const guessed = classifyDocument(fileName);
  // README is a repository concept; manual documents use Notes instead, and anything unrecognised is Notes too.
  const category: DocumentCategory = guessed === "README" || guessed === "OTHER" ? "NOTES" : guessed;
  return { title, category, content };
}
