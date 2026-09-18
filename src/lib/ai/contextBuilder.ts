import type { DocumentCategory } from "@/types/documentation";
import type { BuiltContext, ContextDocument, ContextSource, OmittedDocument } from "@/lib/ai/types";

export const DEFAULT_CONTEXT_CHAR_BUDGET = 12_000;

/** README > Architecture > Setup > PRD > Design > API > Notes > everything else, per the Phase 10 spec. */
const CATEGORY_PRIORITY: DocumentCategory[] = [
  "README",
  "ARCHITECTURE",
  "SETUP",
  "PRD",
  "DESIGN",
  "API",
  "NOTES",
  "PLAN",
  "AI_RULES",
  "OTHER",
];

function priorityIndex(category: DocumentCategory): number {
  const index = CATEGORY_PRIORITY.indexOf(category);
  return index === -1 ? CATEGORY_PRIORITY.length : index;
}

const TRUNCATION_MARKER = "\n[... truncated to fit context size limit ...]";
const MIN_TRUNCATED_CONTENT_LENGTH = 200;

function renderBlock(label: string, doc: { title: string; category: DocumentCategory; content: string }): string {
  return `[${label}] ${doc.title} (${doc.category})\n${doc.content}\n---\n`;
}

/**
 * Deterministically packs a project's documentation into a character-budgeted
 * block, in priority order, assigning each included document a stable
 * [DOC-n] label. Never silently drops documents — anything that doesn't fit
 * is reported in `omitted` (or `truncatedLabel` for a partially-included doc)
 * so the caller can tell the model coverage is incomplete.
 */
export function buildProjectContext(
  documents: ContextDocument[],
  charBudget: number = DEFAULT_CONTEXT_CHAR_BUDGET,
): BuiltContext {
  const sorted = [...documents].sort((a, b) => priorityIndex(a.category) - priorityIndex(b.category));

  const blocks: string[] = [];
  const sources: ContextSource[] = [];
  const omitted: OmittedDocument[] = [];
  let truncatedLabel: string | null = null;
  let remaining = charBudget;
  let budgetExhausted = false;

  for (const doc of sorted) {
    if (budgetExhausted) {
      omitted.push({ documentId: doc.documentId, title: doc.title, category: doc.category });
      continue;
    }

    const label = `DOC-${sources.length + 1}`;
    const fullBlock = renderBlock(label, doc);

    if (fullBlock.length <= remaining) {
      blocks.push(fullBlock);
      sources.push({ label, documentId: doc.documentId, title: doc.title, category: doc.category });
      remaining -= fullBlock.length;
      continue;
    }

    const overhead = fullBlock.length - doc.content.length;
    const availableForContent = remaining - overhead - TRUNCATION_MARKER.length;

    if (availableForContent >= MIN_TRUNCATED_CONTENT_LENGTH) {
      const truncatedContent = doc.content.slice(0, availableForContent) + TRUNCATION_MARKER;
      blocks.push(renderBlock(label, { ...doc, content: truncatedContent }));
      sources.push({ label, documentId: doc.documentId, title: doc.title, category: doc.category });
      truncatedLabel = label;
    } else {
      omitted.push({ documentId: doc.documentId, title: doc.title, category: doc.category });
    }

    budgetExhausted = true;
  }

  return { contextText: blocks.join("\n"), sources, omitted, truncatedLabel };
}
