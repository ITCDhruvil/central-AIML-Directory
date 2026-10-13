"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { Dropdown } from "@/components/ui/Dropdown";
import { AUDIT_CATEGORIES, describeMeta } from "@/lib/auditCatalog";
import { AUDIT_PAGE_SIZE, filterToParams } from "@/lib/auditFilter";
import type { AuditEntryDto } from "@/lib/auditQuery";
import { cn } from "@/lib/cn";

const CATEGORY_OPTIONS = [
  { value: "", label: "All activity" },
  ...AUDIT_CATEGORIES.map((c) => ({ value: c, label: c })),
];
const PERIOD_OPTIONS = [
  { value: "", label: "All time" },
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const CATEGORY_STYLE: Record<string, string> = {
  "Sign-in": "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  "Users & access":
    "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  Settings:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  Projects:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  Ideas:
    "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
  Documents: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

// Fixed locale so the server and browser render the same text.
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

type Page = {
  entries: AuditEntryDto[];
  total: number;
  page: number;
  pageSize: number;
};

/** Who did what and when across the workspace. Filter, search, page through, or export the filtered view as CSV. */
export function AuditLog() {
  const [category, setCategory] = useState("");
  const [days, setDays] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState(""); // the search actually applied, so typing doesn't fire a request per keystroke
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const params = filterToParams({
    category,
    days: days ? Number(days) : null,
    q,
    page,
  });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/audit?${params.toString()}`)
      .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok)
          return setError(
            (body as { error?: string }).error ??
              "Failed to load the audit log",
          );
        setError(null);
        setData(body as Page);
      })
      .catch(() => !cancelled && setError("Network error — please try again"));
    return () => {
      cancelled = true;
    };
    // `params` is rebuilt from the four values below on every render, so depend on those instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, days, q, page]);

  const exportParams = filterToParams({
    category,
    days: days ? Number(days) : null,
    q,
  });
  exportParams.set("format", "csv");
  const pages = data
    ? Math.max(1, Math.ceil(data.total / (data.pageSize || AUDIT_PAGE_SIZE)))
    : 1;

  return (
    <SettingsCard
      title="Audit log"
      description="Sign-ins, account and permission changes, settings and edits to projects, ideas and documents."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Dropdown
            value={category}
            onChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
            options={CATEGORY_OPTIONS}
            aria-label="Category"
            className="w-44"
          />
          <Dropdown
            value={days}
            onChange={(v) => {
              setDays(v);
              setPage(1);
            }}
            options={PERIOD_OPTIONS}
            aria-label="Period"
            className="w-44"
          />
          <div className="field flex h-10 min-w-48 flex-1 items-center gap-2 py-0">
            <Search size={15} className="shrink-0 text-zinc-400" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people, items or details"
              aria-label="Search the audit log"
              className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-zinc-400"
            />
          </div>
          <a
            href={`/api/admin/audit?${exportParams.toString()}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Download size={15} />
            Export CSV
          </a>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        {!data ? (
          !error && <p className="text-sm text-zinc-500">Loading…</p>
        ) : data.entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Nothing matches these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs text-zinc-500 dark:text-zinc-400">
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Who</th>
                  <th className="px-3 py-2 font-medium">What happened</th>
                  <th className="px-3 py-2 font-medium">Details</th>
                  <th className="py-2 pl-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 align-top dark:divide-zinc-800">
                {data.entries.map((e) => (
                  <tr key={e.id}>
                    <td
                      className="whitespace-nowrap py-2.5 pr-3 text-zinc-500 dark:text-zinc-400"
                      suppressHydrationWarning
                    >
                      {when(e.createdAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-zinc-800 dark:text-zinc-200">
                        {e.actorName ?? "Unknown"}
                      </p>
                      {e.actorEmail && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {e.actorEmail}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {e.label}
                      </span>
                      {e.category && (
                        <span
                          className={cn(
                            "ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium",
                            CATEGORY_STYLE[e.category],
                          )}
                        >
                          {e.category}
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs px-3 py-2.5 text-zinc-600 dark:text-zinc-300">
                      <span className="break-words">
                        {describeMeta(e.meta) || "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-2.5 pl-3 text-xs text-zinc-500 dark:text-zinc-400">
                      {e.ip ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > 0 && (
          <div className="flex items-center justify-between gap-3 text-sm text-zinc-500 dark:text-zinc-400">
            <span>
              {((data.page - 1) * data.pageSize + 1).toLocaleString("en-US")}–
              {Math.min(data.page * data.pageSize, data.total).toLocaleString(
                "en-US",
              )}{" "}
              of {data.total.toLocaleString("en-US")}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 tabular-nums">
                {page} / {pages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                aria-label="Next page"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </SettingsCard>
  );
}
