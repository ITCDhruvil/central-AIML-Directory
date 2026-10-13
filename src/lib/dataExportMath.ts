// Pure helpers for exports, so they can be tested without a database.

/** Lists (technologies, tags, URLs) are stored as JSON text. Returns the strings in one, or [] for anything else. */
export function parseList(stored: string | null | undefined): string[] {
  if (!stored) return [];
  try {
    const value = JSON.parse(stored);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** A list as one spreadsheet cell, e.g. "Python; FastAPI". */
export function listToCell(stored: string | null | undefined): string {
  return parseList(stored).join("; ");
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** A safe download name such as "projects-2026-10-13.csv". */
export function exportFilename(kind: string, ext: "csv" | "json", now: Date = new Date()): string {
  return `${slug(kind) || "export"}-${now.toISOString().slice(0, 10)}.${ext}`;
}
