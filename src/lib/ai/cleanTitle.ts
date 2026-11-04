const MAX_TITLE = 80;

/**
 * Turns whatever the AI returned into a plain, short title: first line only, no Markdown headings or emphasis, no
 * wrapping quotes, no "Title:" label and no trailing punctuation. Cut at a word boundary if it is still too long.
 */
export function cleanTitle(raw: string): string {
  let title = (raw.split(/\r?\n/).find((line) => line.trim() !== "") ?? "").trim();
  title = title.replace(/^#{1,6}\s*/, "").replace(/^title\s*:\s*/i, "");
  title = title.replace(/[*_`]/g, "");
  title = title.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  title = title.replace(/[.:;,\s]+$/, "");
  if (title.length > MAX_TITLE) {
    const cut = title.slice(0, MAX_TITLE);
    title = cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).trim();
  }
  return title;
}
