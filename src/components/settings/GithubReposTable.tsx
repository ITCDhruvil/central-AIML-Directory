"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Lock, Plus, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { GithubRepoRow, GithubReposResponse } from "@/types/github";

const COLLAPSED_ROWS = 8;

const TAG =
  "inline-flex items-center rounded-full border border-zinc-200 px-1.5 py-px text-[11px] font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-400";

export function GithubReposTable({ onExpired }: { onExpired?: () => void }) {
  const router = useRouter();
  const [adding, setAdding] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [data, setData] = useState<GithubReposResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch("/api/github/repos")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((body: GithubReposResponse) => {
        setData(body);
        if (body.state === "expired") onExpired?.();
      })
      .catch(() => setFailed(true));
    // Loaded once per visit; onExpired is only a notification.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Imports the repository, fills in its details and creates the project, then opens it.
  async function addAsProject(repo: GithubRepoRow) {
    setAdding(repo.fullName);
    setAddError(null);
    try {
      const res = await fetch("/api/github/repos/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: repo.fullName }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddError(`${repo.fullName}: ${body.error ?? "could not be added."}`);
        setAdding(null);
        return;
      }
      router.push(`/projects/${body.project.id}`);
      router.refresh();
    } catch {
      setAddError(`${repo.fullName}: network error — please try again.`);
      setAdding(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = data?.repos ?? [];
    return q
      ? all.filter((r) => r.fullName.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q))
      : all;
  }, [data, query]);

  if (failed || data?.state === "unavailable") {
    return <p className="text-xs text-zinc-500 dark:text-zinc-400">Could not load your repositories from GitHub right now.</p>;
  }
  if (!data) {
    return (
      <div className="animate-pulse space-y-2" aria-label="Loading repositories">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 rounded-md bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </div>
    );
  }
  if (data.state === "expired") return null;

  const visible = showAll || query ? filtered : filtered.slice(0, COLLAPSED_ROWS);
  const imported = data.repos.filter((r) => r.project).length;
  const privateCount = data.repos.filter((r) => r.isPrivate).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Your repositories</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {data.repos.length}
            {data.truncated ? "+" : ""} repositories · {privateCount} private · {imported} added as projects
          </p>
        </div>
        {data.repos.length > COLLAPSED_ROWS && (
          <label className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search repositories"
              className="field w-56 !py-1.5 !pl-8 text-sm"
            />
          </label>
        )}
      </div>

      {adding && (
        <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
          Adding {adding}: reading the repository, filling in the details and creating the project. This can take up to a
          minute.
        </p>
      )}
      {addError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{addError}</p>
      )}

      {data.repos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No repositories found for this GitHub account.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2 font-medium">Repository</th>
                <th className="px-3 py-2 font-medium">Language</th>
                <th className="px-3 py-2 font-medium">Updated</th>
                <th className="px-3 py-2 text-right font-medium">Project</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {visible.map((repo) => (
                <tr key={repo.fullName} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="max-w-[22rem] px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <a
                        href={repo.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        {repo.fullName}
                      </a>
                      {repo.isPrivate && (
                        <span className={TAG}>
                          <Lock size={10} className="mr-0.5" />
                          Private
                        </span>
                      )}
                      {repo.isFork && <span className={TAG}>Fork</span>}
                      {repo.isArchived && <span className={TAG}>Archived</span>}
                    </div>
                    {repo.description && (
                      <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400" title={repo.description}>
                        {repo.description}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-zinc-600 dark:text-zinc-300">
                    {repo.language ?? <span className="text-zinc-400">—</span>}
                    {repo.stars > 0 && (
                      <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-zinc-400">
                        <Star size={11} />
                        {repo.stars}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-zinc-500 dark:text-zinc-400">
                    {repo.pushedAt ? formatRelativeTime(repo.pushedAt) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    {repo.project ? (
                      <Link
                        href={`/projects/${repo.project.id}`}
                        title={repo.project.name}
                        className="inline-flex max-w-[11rem] items-center gap-1 text-xs font-medium text-green-700 hover:underline dark:text-green-400"
                      >
                        <Check size={13} className="shrink-0" />
                        <span className="truncate">Added</span>
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={Plus}
                        loading={adding === repo.fullName}
                        disabled={adding !== null}
                        onClick={() => void addAsProject(repo)}
                      >
                        {adding === repo.fullName ? "Adding…" : "Add as project"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-zinc-500">
                    No repositories match “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!query && filtered.length > COLLAPSED_ROWS && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {showAll ? "Show fewer" : `Show all ${filtered.length}`}
        </button>
      )}
      {data.truncated && (
        <p className="text-xs text-zinc-400">Showing your 100 most recently updated repositories.</p>
      )}
    </div>
  );
}
