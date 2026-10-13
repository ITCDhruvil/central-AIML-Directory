// Browser-safe: turns URL query parameters into a validated audit filter. Shared by the API and the admin page.
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, actionsIn, type AuditCategory } from "@/lib/auditCatalog";

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_PERIODS = [1, 7, 30, 90] as const;

export type AuditFilter = {
  /** Restrict to these actions; null = every action. */
  actions: string[] | null;
  actorId: string | null;
  /** Free text matched against the person, the entity and the details. */
  q: string;
  /** Only the last N days; null = all time. */
  days: number | null;
  page: number;
};

export function parseAuditFilter(get: (key: string) => string | null): AuditFilter {
  const action = get("action");
  const category = get("category");
  let actions: string[] | null = null;
  if (action && action in AUDIT_ACTIONS) actions = [action];
  else if (category && (AUDIT_CATEGORIES as string[]).includes(category)) actions = actionsIn(category as AuditCategory);

  const days = Number(get("days"));
  const page = Number(get("page"));
  return {
    actions,
    actorId: get("actor")?.trim() || null,
    q: (get("q") ?? "").trim().slice(0, 100),
    days: (AUDIT_PERIODS as readonly number[]).includes(days) ? days : null,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** The same filter as URL parameters, for links and the CSV export. Defaults are left out. */
export function filterToParams(f: Partial<AuditFilter> & { category?: string }): URLSearchParams {
  const p = new URLSearchParams();
  if (f.category) p.set("category", f.category);
  if (f.actorId) p.set("actor", f.actorId);
  if (f.q) p.set("q", f.q);
  if (f.days) p.set("days", String(f.days));
  if (f.page && f.page > 1) p.set("page", String(f.page));
  return p;
}
