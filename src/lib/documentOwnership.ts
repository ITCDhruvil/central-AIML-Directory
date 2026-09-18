import type { DocumentSource } from "@/types/documentation";

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

export function isDeletableDocument(source: string): boolean {
  return source === "manual";
}

const SOURCE_LABELS: Record<DocumentSource, string> = {
  github: "GitHub",
  generated: "Generated",
  manual: "Manual",
};

/** Human-friendly label — never expose the raw source="..." string in the UI. */
export function documentSourceLabel(source: string): string {
  return SOURCE_LABELS[source as DocumentSource] ?? source;
}
