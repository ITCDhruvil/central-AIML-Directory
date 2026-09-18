"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CircleCheck, LayoutGrid, List, SearchX, SlidersHorizontal, X } from "lucide-react";
import { ProjectCard } from "@/components/ProjectCard";
import { ProjectListRow } from "@/components/ProjectListRow";
import { IdeaCard } from "@/components/IdeaCard";
import { DocumentSearchResult } from "@/components/DocumentSearchResult";
import { SearchInput } from "@/components/SearchInput";
import { EmptyState } from "@/components/EmptyState";
import { Dropdown } from "@/components/ui/Dropdown";
import { ToggleFilter } from "@/components/ui/ToggleFilter";
import { Button } from "@/components/ui/Button";
import { GithubIcon } from "@/components/icons/GithubIcon";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { CARD_GRID_CLASS } from "@/components/ContentCard";
import { cn } from "@/lib/cn";
import { PROJECT_STATUSES, PROJECT_TYPES, type Project } from "@/types/project";
import { SORT_LABELS, SORT_OPTIONS, applyClientFilters, sortProjects, type SortOption } from "@/lib/projectExplorer";
import { STATUS_ICONS, TYPE_ICONS } from "@/lib/projectOptionIcons";
import type { SearchResponse } from "@/lib/search/types";

type ViewMode = "grid" | "list";

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  ...PROJECT_TYPES.map((t) => ({ value: t, label: t, icon: TYPE_ICONS[t].icon, iconClassName: TYPE_ICONS[t].className })),
];
const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  ...PROJECT_STATUSES.map((s) => ({ value: s, label: s, icon: STATUS_ICONS[s].icon, iconClassName: STATUS_ICONS[s].className })),
];
const SORT_DROPDOWN_OPTIONS = SORT_OPTIONS.map((o) => ({ value: o, label: SORT_LABELS[o] }));

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-red-300 px-6 py-10 text-center text-sm text-red-600 dark:border-red-900 dark:text-red-400">
      <AlertCircle size={20} />
      <p>{message}</p>
      <Button variant="ghost" size="sm" onClick={onRetry} className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">
        Try again
      </Button>
    </div>
  );
}

export function ProjectExplorer({ initialProjects }: { initialProjects: Project[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [loading, startTransition] = useTransition();
  const [loadError, setLoadError] = useState(false);

  const urlQ = searchParams.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [githubConnectedOnly, setGithubConnectedOnly] = useState(false);
  const [sort, setSort] = useState<SortOption>("updated-desc");
  const [view, setView] = useState<ViewMode>("grid");
  const [retryToken, setRetryToken] = useState(0);

  if (urlQ !== prevUrlQ) {
    setPrevUrlQ(urlQ);
    setQ(urlQ);
  }

  const isSearching = q.trim().length > 0;
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [searchLoading, startSearchTransition] = useTransition();
  const [searchError, setSearchError] = useState(false);
  const [searchRetryToken, setSearchRetryToken] = useState(0);

  function updateQuery(next: string) {
    setQ(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next.trim()) params.set("q", next);
    else params.delete("q");
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }

  // Normal browsing mode: project list filtered by type/status (server) —
  // unchanged from Phase 7 except `q` no longer feeds this endpoint, since
  // `q` now drives global search instead (see the effect below).
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (status) params.set("status", status);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/projects?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) {
          setLoadError(true);
          return;
        }
        const body = await res.json();
        setProjects(body.projects ?? []);
        setLoadError(false);
      } catch (err) {
        if (!(err instanceof Error) || err.name !== "AbortError") setLoadError(true);
      }
    });

    return () => controller.abort();
    // `initialProjects` is included so that a server refresh elsewhere on this
    // page (e.g. deleting a project from a card menu, which calls
    // router.refresh()) re-fetches instead of leaving this component's state
    // stale — useState(initialProjects) only seeds the very first render.
  }, [type, status, retryToken, initialProjects]);

  // Global search mode: `q` now searches project name/description/technology
  // AND documentation title/category/content, server-side.
  useEffect(() => {
    if (!isSearching) return;
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      startSearchTransition(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
          if (!res.ok) throw new Error("search failed");
          const body = (await res.json()) as SearchResponse;
          setSearchResult(body);
          setSearchError(false);
        } catch (err) {
          if (!(err instanceof Error) || err.name !== "AbortError") setSearchError(true);
        }
      });
    }, 200);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [q, isSearching, searchRetryToken]);

  const visible = useMemo(() => {
    const filtered = applyClientFilters(projects, { githubConnectedOnly });
    return sortProjects(filtered, sort);
  }, [projects, githubConnectedOnly, sort]);

  const hasActiveFilters = Boolean(type || status || githubConnectedOnly);

  return (
    <div className="space-y-4">
      <div id="filters" className="scroll-mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="sm:min-w-72 sm:flex-1">
          <SearchInput
            value={q}
            onChange={updateQuery}
            placeholder="Search projects, ideas, and documentation..."
          />
        </div>
        {!isSearching && (
          <>
            <Dropdown value={type} onChange={setType} options={TYPE_OPTIONS} aria-label="Filter by type" icon={SlidersHorizontal} className="sm:w-40" />
            <Dropdown value={status} onChange={setStatus} options={STATUS_OPTIONS} aria-label="Filter by status" icon={CircleCheck} className="sm:w-40" />
            <Dropdown value={sort} onChange={(v) => setSort(v as SortOption)} options={SORT_DROPDOWN_OPTIONS} aria-label="Sort projects" className="sm:w-44" />
            <ToggleFilter
              label="GitHub connected"
              checked={githubConnectedOnly}
              onChange={setGithubConnectedOnly}
              icon={GithubIcon}
              className="sm:w-auto"
            />
            <div className="ml-auto flex items-center gap-1 rounded-md border border-zinc-300 p-0.5 dark:border-zinc-700">
              <button
                type="button"
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded",
                  view === "grid"
                    ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
                    : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                )}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                aria-label="List view"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded",
                  view === "list"
                    ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
                    : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                )}
              >
                <List size={14} />
              </button>
            </div>
          </>
        )}
        {isSearching && (
          <Button variant="ghost" size="sm" icon={X} onClick={() => updateQuery("")}>
            Clear search
          </Button>
        )}
      </div>

      {isSearching ? (
        <div className="space-y-6">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Search: &quot;{q.trim()}&quot;</p>

          {searchError ? (
            <ErrorPanel message="Unable to search." onRetry={() => setSearchRetryToken((t) => t + 1)} />
          ) : searchLoading && !searchResult ? (
            <SkeletonCardGrid count={3} />
          ) : searchResult &&
            searchResult.projects.length === 0 &&
            (searchResult.ideas?.length ?? 0) === 0 &&
            searchResult.documentation.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No results found."
              description="Try a different search term, or clear the search to browse all projects."
            />
          ) : (
            <>
              {searchResult && searchResult.projects.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Projects
                  </h2>
                  <div className={cn("mt-2", CARD_GRID_CLASS)}>
                    {searchResult.projects.map((r) => (
                      <ProjectCard key={r.project.id} project={r.project} />
                    ))}
                  </div>
                </div>
              )}
              {searchResult && (searchResult.ideas?.length ?? 0) > 0 && (
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Ideas
                  </h2>
                  <div className={cn("mt-2", CARD_GRID_CLASS)}>
                    {searchResult.ideas.map((r) => (
                      <IdeaCard key={r.idea.id} idea={r.idea} />
                    ))}
                  </div>
                </div>
              )}
              {searchResult && searchResult.documentation.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Documentation
                  </h2>
                  <div className="mt-2 space-y-2">
                    {searchResult.documentation.map((r) => (
                      <DocumentSearchResult key={r.document.id} result={r} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : loadError ? (
        <ErrorPanel message="Unable to load projects." onRetry={() => setRetryToken((t) => t + 1)} />
      ) : loading ? (
        <SkeletonCardGrid />
      ) : visible.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState icon={SearchX} title="No projects match your search." description="Try adjusting your filters." />
        ) : (
          <EmptyState
            title="No projects yet."
            description="Create a project manually or import one from GitHub."
            actionHref="/projects/new"
            actionLabel="New Project"
          />
        )
      ) : view === "list" ? (
        <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 [&>*:first-child]:rounded-t-lg [&>*:last-child]:rounded-b-lg dark:divide-zinc-800 dark:border-zinc-800">
          {visible.map((project) => (
            <ProjectListRow key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className={CARD_GRID_CLASS}>
          {visible.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
