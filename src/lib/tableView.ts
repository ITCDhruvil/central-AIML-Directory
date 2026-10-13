// Pure helpers for tables that can be searched and paged (used by tables in chat replies).

/** The visible text inside a rendered node: strings and numbers, joined across nested children. No React import needed. */
export function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).filter(Boolean).join(" ");
  if (typeof node === "object" && "props" in node) {
    return textOf((node as { props?: { children?: unknown } }).props?.children);
  }
  return "";
}

/** Case-insensitive "contains"; an empty query matches everything. */
export function matchesText(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === "" || text.toLowerCase().includes(q);
}

export type Page<T> = { items: T[]; page: number; totalPages: number };

/** One page of `items`. An out-of-range page is pulled back to the nearest real one (e.g. after a search shrinks the list). */
export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), page: current, totalPages };
}
