import type { SnippetSegment } from "@/lib/search/types";

const SNIPPET_CONTEXT_CHARS = 60;

/** Lowercased, whitespace-split query terms. Empty/whitespace-only queries yield []. */
export function tokenize(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/** True if every token appears as a substring of `haystack` (case-insensitive, any order). */
export function containsAllTokens(haystack: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  const lower = haystack.toLowerCase();
  return tokens.every((token) => lower.includes(token));
}

/**
 * Builds a short, plain-text snippet around the earliest token match in
 * `content`, with the matched token marked for highlighting. Never returns
 * HTML/Markdown — just text segments the UI renders as-is (safe by
 * construction: no dangerouslySetInnerHTML anywhere downstream).
 */
export function buildSnippet(content: string, tokens: string[]): SnippetSegment[] {
  const lower = content.toLowerCase();
  let matchIndex = -1;
  let matchLength = 0;

  for (const token of tokens) {
    const idx = lower.indexOf(token);
    if (idx !== -1 && (matchIndex === -1 || idx < matchIndex)) {
      matchIndex = idx;
      matchLength = token.length;
    }
  }

  if (matchIndex === -1) {
    return [{ text: content.slice(0, SNIPPET_CONTEXT_CHARS * 2).trim(), highlighted: false }];
  }

  const start = Math.max(0, matchIndex - SNIPPET_CONTEXT_CHARS);
  const end = Math.min(content.length, matchIndex + matchLength + SNIPPET_CONTEXT_CHARS);

  const segments: SnippetSegment[] = [];
  const before = (start > 0 ? "…" : "") + content.slice(start, matchIndex);
  if (before) segments.push({ text: before, highlighted: false });

  segments.push({ text: content.slice(matchIndex, matchIndex + matchLength), highlighted: true });

  const after = content.slice(matchIndex + matchLength, end) + (end < content.length ? "…" : "");
  if (after) segments.push({ text: after, highlighted: false });

  return segments;
}
