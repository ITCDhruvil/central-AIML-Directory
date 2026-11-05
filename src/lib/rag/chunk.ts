// Pure text chunker for RAG ingestion. Heading-aware (keeps a Markdown section together) with a size cap and overlap,
// per the production-RAG baseline (~500 tokens, 10% overlap). Browser-safe (no deps), so it is unit-tested directly.

const APPROX_CHARS_PER_TOKEN = 4;
export const DEFAULT_MAX_CHARS = 2000; // ~500 tokens
export const DEFAULT_OVERLAP = 200; // ~10%

export function approxTokens(text: string): number {
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN);
}

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Splits into Markdown sections: a heading line starts a new section and stays with its body. */
function splitByHeadings(text: string): string[] {
  const lines = text.split("\n");
  const sections: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line) && current.some((l) => l.trim() !== "")) {
      sections.push(current.join("\n").trim());
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) sections.push(current.join("\n").trim());
  return sections.filter((s) => s !== "");
}

/** A long section is split on the nearest line/space break before the cap, with `overlap` characters carried over. */
function splitLong(section: string, maxChars: number, overlap: number): string[] {
  const out: string[] = [];
  let start = 0;
  while (start < section.length) {
    let end = Math.min(start + maxChars, section.length);
    if (end < section.length) {
      const nl = section.lastIndexOf("\n", end);
      const sp = section.lastIndexOf(" ", end);
      const half = start + maxChars * 0.5;
      if (nl > half) end = nl;
      else if (sp > half) end = sp;
    }
    const piece = section.slice(start, end).trim();
    if (piece) out.push(piece);
    if (end >= section.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return out;
}

export function chunkText(text: string, maxChars = DEFAULT_MAX_CHARS, overlap = DEFAULT_OVERLAP): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const chunks: string[] = [];
  for (const section of splitByHeadings(normalized)) {
    if (section.length <= maxChars) chunks.push(section);
    else chunks.push(...splitLong(section, maxChars, overlap));
  }
  return chunks.filter((c) => c.trim() !== "");
}
