"use client";

import { useEffect, useState } from "react";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { RESOURCE_LABELS } from "@/lib/auth/permissionLabels";
import type { UsageReport } from "@/lib/ai/usageReport";
import { cn } from "@/lib/cn";

const RANGES = [7, 14, 30, 90] as const;

const num = (n: number) => n.toLocaleString("en-US");
const compact = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
      ? `${(n / 1000).toFixed(1)}k`
      : String(n);
// Fixed locale so server and browser agree.
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const STATUS_STYLE: Record<string, string> = {
  OK: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  ERROR: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  BLOCKED_QUOTA:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  BLOCKED_PERMISSION:
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};
const STATUS_LABEL: Record<string, string> = {
  OK: "OK",
  ERROR: "Error",
  BLOCKED_QUOTA: "Over limit",
  BLOCKED_PERMISSION: "Switched off",
};

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      )}
    </div>
  );
}

export function AiUsage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(7);
  const [report, setReport] = useState<UsageReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/ai/usage?days=${days}`)
      .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok)
          return setError(
            (body as { error?: string }).error ?? "Failed to load usage",
          );
        setError(null);
        setReport(body as UsageReport);
      })
      .catch(() => !cancelled && setError("Network error — please try again"));
    return () => {
      cancelled = true;
    };
  }, [days]);

  const maxDaily = Math.max(
    1,
    ...(report?.daily.map((d) => d.requests) ?? [1]),
  );
  const maxFeature = Math.max(
    1,
    ...(report?.byFeature.map((f) => f.requests) ?? [1]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Usage
        </h2>
        <div
          className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800"
          role="group"
          aria-label="Time range"
        >
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDays(r)}
              aria-pressed={days === r}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                days === r
                  ? "bg-orange-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
              )}
            >
              {r} days
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {!report ? (
        !error && <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi
              label="Requests"
              value={num(report.totals.requests)}
              hint={`last ${report.days} days`}
            />
            <Kpi
              label="Tokens"
              value={compact(report.totals.tokens)}
              hint="input + output"
            />
            <Kpi
              label="Blocked"
              value={num(report.totals.blocked)}
              hint="switched off or over limit"
            />
            <Kpi
              label="Errors"
              value={num(report.totals.errors)}
              hint="model call failed"
            />
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <SettingsCard title="Requests per day">
              <div
                className="flex h-40 items-end gap-1"
                role="img"
                aria-label="Requests per day"
              >
                {report.daily.map((d) => (
                  <div
                    key={d.date}
                    className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
                    title={`${d.date}: ${d.requests} requests, ${num(d.tokens)} tokens`}
                  >
                    <div
                      className="w-full rounded-t bg-orange-500/80 transition-colors group-hover:bg-orange-600"
                      style={{
                        height: `${Math.max(d.requests > 0 ? 4 : 0, (d.requests / maxDaily) * 100)}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-zinc-400">
                <span>{report.daily[0]?.date}</span>
                <span>{report.daily[report.daily.length - 1]?.date}</span>
              </div>
            </SettingsCard>

            <SettingsCard title="By feature">
              {report.byFeature.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No AI activity in this period.
                </p>
              ) : (
                <ul className="space-y-3">
                  {report.byFeature.map((f) => (
                    <li key={f.feature}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {RESOURCE_LABELS[f.feature] ?? f.feature}
                        </span>
                        <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                          {num(f.requests)} · {compact(f.tokens)} tokens
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-orange-500"
                          style={{
                            width: `${(f.requests / maxFeature) * 100}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SettingsCard>
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <SettingsCard title="Top users">
              {report.topUsers.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Nobody has used AI in this period.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {report.topUsers.map((u) => (
                    <li
                      key={u.userId}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium text-zinc-800 dark:text-zinc-200">
                        {u.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
                        {num(u.requests)} req · {compact(u.tokens)} tok
                        {u.blocked > 0 && ` · ${u.blocked} blocked`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SettingsCard>

            <SettingsCard title="Recent activity">
              {report.recent.length === 0 ? (
                <p className="text-sm text-zinc-500">Nothing yet.</p>
              ) : (
                <div className="max-h-96 overflow-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead className="sticky top-0 bg-white text-left text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                      <tr>
                        <th className="py-2 pr-3 font-medium">When</th>
                        <th className="px-3 py-2 font-medium">Who</th>
                        <th className="px-3 py-2 font-medium">Feature</th>
                        <th className="px-3 py-2 text-right font-medium">
                          Tokens
                        </th>
                        <th className="py-2 pl-3 font-medium">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {report.recent.map((r) => (
                        <tr key={r.id}>
                          <td
                            className="whitespace-nowrap py-2 pr-3 text-zinc-500 dark:text-zinc-400"
                            suppressHydrationWarning
                          >
                            {when(r.createdAt)}
                          </td>
                          <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200">
                            {r.userName}
                          </td>
                          <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                            {RESOURCE_LABELS[r.feature] ?? r.feature}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                            {r.tokens > 0 ? num(r.tokens) : "—"}
                          </td>
                          <td className="py-2 pl-3">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-xs font-medium",
                                STATUS_STYLE[r.status] ??
                                  STATUS_STYLE.BLOCKED_PERMISSION,
                              )}
                            >
                              {STATUS_LABEL[r.status] ?? r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SettingsCard>
          </div>
        </>
      )}
    </div>
  );
}
