import { UPLOAD_SOURCE } from "@/types/documentation";

/**
 * Only manually-created documents can be edited or deleted through the
 * documentation UI/API. This is deliberately independent of Phase 6's sync
 * ownership rules (which decide what GitHub sync may overwrite) — it never
 * conflicts with that logic because it answers a different question ("can a
 * person edit this record") and Phase 6's compare/apply code never calls it.
 */
export function isEditableDocument(source: string): boolean {
  return source === "manual";
}

/** Uploaded files can be removed but not edited: there is no text to edit. */
export function isDeletableDocument(source: string): boolean {
  return source === "manual" || source === UPLOAD_SOURCE;
}

const SOURCE_LABELS: Record<string, string> = {
  github: "GitHub",
  generated: "Generated",
  manual: "Manual",
  [UPLOAD_SOURCE]: "Uploaded",
};

const ACRONYM_CATEGORIES = new Set(["README", "PRD", "API"]);

/** "AI_RULES" -> "AI rules", "SETUP" -> "Setup"; acronyms stay upper-case. */
export function documentCategoryLabel(category: string): string {
  if (ACRONYM_CATEGORIES.has(category)) return category;
  const words = category.split("_").map((w) => (w === "AI" ? w : w.toLowerCase()));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Human-friendly label — never expose the raw source="..." string in the UI. */
export function documentSourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}
