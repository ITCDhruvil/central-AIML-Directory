"use client";

import { useAuthUser, useCan } from "@/components/AuthProvider";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, LayoutGrid, List, Plus, SearchX, X } from "lucide-react";
import { ProjectCard } from "@/components/ProjectCard";
import { EditTableModal } from "@/components/EditTableModal";
import { ProjectTable } from "@/components/ProjectTable";
import { IdeaCard } from "@/components/IdeaCard";
import { DocumentSearchResult } from "@/components/DocumentSearchResult";
import { SearchInput } from "@/components/SearchInput";
import { EmptyState } from "@/components/EmptyState";
import { FilterMenu, type FilterSection } from "@/components/ui/FilterMenu";
import { ToggleFilter } from "@/components/ui/ToggleFilter";
import { Button } from "@/components/ui/Button";
import { GithubIcon } from "@/components/icons/GithubIcon";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { CARD_GRID_CLASS } from "@/components/ContentCard";
import { cn } from "@/lib/cn";
import { usePagination } from "@/lib/usePagination";
import { PROJECT_STATUSES, PROJECT_TYPES, type Project } from "@/types/project";
import { SORT_LABELS, SORT_OPTIONS, applyClientFilters } from "@/lib/projectExplorer";
import {
  matchesOwnerFilter,
  normalizeColumns,
  ownerOptions,
  presetToSort,
  sortProjectsBy,
  sortToPreset,
  type ColumnId,
  type SortState,
} from "@/lib/projectTable";
import { STATUS_ICONS, TYPE_ICONS } from "@/lib/projectOptionIcons";
import type { SearchResponse } from "@/lib/search/types";

type ViewMode = "grid" | "list";

const TYPE_OPTIONS = PROJECT_TYPES.map((t) => ({ value: t, label: t, icon: TYPE_ICONS[t].icon, iconClassName: TYPE_ICONS[t].className }));
const STATUS_OPTIONS = PROJECT_STATUSES.map((s) => ({ value: s, label: s, icon: STATUS_ICONS[s].icon, iconClassName: STATUS_ICONS[s].className }));
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

export function ProjectExplorer({
  initialProjects,
  columns: defaultColumns,
  canSetDefaultColumns,
  myOwnerNames,
  variant = "dashboard",
  initialFilters,
}: {
  initialProjects: Project[];
  /** The table columns an admin chose for everyone. */
  columns: ColumnId[];
  /** True for admins: their table edits become the default for everyone instead of a personal layout. */
  canSetDefaultColumns: boolean;
  /** Owner names that count as "mine" for the signed-in user (their name plus any linked owner names). */
  myOwnerNames: string[];
  /**
   * "dashboard": search runs the global search (projects, ideas, documents) and lives at "/".
   * "page": the Projects page — search narrows this list only, with a count, pagination and a New Project button.
   */
  variant?: "dashboard" | "page";
  /** Filters carried in the URL (e.g. links from the dashboard cards): ?status=ACTIVE, ?type=POC, ?github=1. */
  initialFilters?: { type?: string; status?: string; github?: boolean };
}) {
  const isPage = variant === "page";
  const basePath = isPage ? "/projects" : "/";
  const canCreate = useCan("projects", "create");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [loading, startTransition] = useTransition();
  const [loadError, setLoadError] = useState(false);

  const urlQ = searchParams.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  const [type, setType] = useState<string[]>(() =>
    initialFilters?.type && (PROJECT_TYPES as readonly string[]).includes(initialFilters.type) ? [initialFilters.type] : [],
  );
  const [status, setStatus] = useState<string[]>(() =>
    initialFilters?.status && (PROJECT_STATUSES as readonly string[]).includes(initialFilters.status) ? [initialFilters.status] : [],
  );
  const [githubConnectedOnly, setGithubConnectedOnly] = useState(Boolean(initialFilters?.github));
  const [sort, setSort] = useState<SortState>({ column: "updated", dir: "desc" });
  const [view, setView] = useState<ViewMode>("list");
  const [editingTable, setEditingTable] = useState(false);
  // Everyone can reshape the table. Admins change the default for all; everyone else keeps a personal layout in this browser.
  const authUser = useAuthUser();
  const storageKey = authUser ? `projects-table-columns:${authUser.id}` : null;
  const [defaultCols, setDefaultCols] = useState<ColumnId[]>(defaultColumns);
  const [personalColumns, setPersonalColumns] = useState<ColumnId[] | null>(null);
  const columns = personalColumns ?? defaultCols;

  useEffect(() => {
    if (!storageKey) return;
    // Read after mount: localStorage doesn't exist during server rendering.
    const frame = window.requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) setPersonalColumns(normalizeColumns(JSON.parse(raw)));
      } catch {
        // storage unavailable or corrupt — fall back to the default layout
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [storageKey]);

  function savePersonalColumns(next: ColumnId[] | null) {
    setPersonalColumns(next);
    if (!storageKey) return;
    try {
      if (next) window.localStorage.setItem(storageKey, JSON.stringify(next));
      else window.localStorage.removeItem(storageKey);
    } catch {
      // storage unavailable — the layout just won't persist
    }
  }

  // Start on the user's own projects when they have any; otherwise everything they can see.
  const [defaultOwner] = useState(() =>
    initialProjects.some((p) => matchesOwnerFilter(p, "me", myOwnerNames, authUser?.id)) ? "me" : "",
  );
  const [ownerFilter, setOwnerFilter] = useState(defaultOwner);
  const [retryToken, setRetryToken] = useState(0);

  if (urlQ !== prevUrlQ) {
    setPrevUrlQ(urlQ);
    setQ(urlQ);
  }

  const isSearching = !isPage && q.trim().length > 0;
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [searchLoading, startSearchTransition] = useTransition();
  const [searchError, setSearchError] = useState(false);
  const [searchRetryToken, setSearchRetryToken] = useState(0);

  /** The Projects page can start from ?status=…&type=…&github=1. Once someone changes a filter those starting values are stale, so drop them. */
  function dropSeedParams() {
    if (!isPage) return;
    const params = new URLSearchParams(searchParams.toString());
    const seeds = ["status", "type", "github"];
    if (!seeds.some((key) => params.has(key))) return;
    seeds.forEach((key) => params.delete(key));
    const qs = params.toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  }

  function updateQuery(next: string) {
    setQ(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next.trim()) params.set("q", next);
    else params.delete("q");
    const qs = params.toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    setPage(1);
  }

  // Normal browsing mode: project list filtered by type/status (server) —
  // unchanged from Phase 7 except `q` no longer feeds this endpoint, since
  // `q` now drives global search instead (see the effect below).
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (isPage && q.trim()) params.set("q", q.trim());

    const run = () => startTransition(async () => {
      try {
        const res = await fetch(`/api/projects${params.size ? `?${params.toString()}` : ""}`, { signal: controller.signal });
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

    // Typing in the Projects page search re-queries after a short pause; everything else loads straight away.
    const timer = window.setTimeout(run, isPage && q.trim() ? 200 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // `initialProjects` is included so that a server refresh elsewhere on this
    // page (e.g. deleting a project from a card menu, which calls
    // router.refresh()) re-fetches instead of leaving this component's state
    // stale — useState(initialProjects) only seeds the very first render.
  }, [retryToken, initialProjects, isPage, q]);

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
    const matching = projects.filter(
      (p) =>
        matchesOwnerFilter(p, ownerFilter, myOwnerNames, authUser?.id) &&
        (type.length === 0 || type.includes(p.type)) &&
        (status.length === 0 || status.includes(p.status)),
    );
    const filtered = applyClientFilters(matching, { githubConnectedOnly });
    return sortProjectsBy(filtered, sort);
  }, [projects, githubConnectedOnly, sort, ownerFilter, myOwnerNames, type, status, authUser?.id]);

  const { pageItems, page, setPage, totalPages } = usePagination(visible, view === "grid" ? 9 : 10);
  const shown = isPage ? pageItems : visible;

  const ownerDropdownOptions = useMemo(() => {
    const names = ownerOptions(projects);
    // Keep the chosen person selectable even if the current type/status filters hide all their projects.
    if (ownerFilter && ownerFilter !== "me" && !names.some((n) => n.toLowerCase() === ownerFilter.toLowerCase())) {
      names.push(ownerFilter);
    }
    return [
      ...(myOwnerNames.length > 0 ? [{ value: "me", label: "My projects" }] : []),
      { value: "", label: "All projects" },
      ...names.map((name) => ({ value: name, label: name })),
    ];
  }, [projects, ownerFilter, myOwnerNames]);

  function sortByColumn(column: ColumnId) {
    setSort((current) =>
      current.column === column
        ? { column, dir: current.dir === "asc" ? "desc" : "asc" }
        : { column, dir: column === "updated" || column === "created" || column === "synced" ? "desc" : "asc" },
    );
  }

  const hasActiveFilters = Boolean(type.length || status.length || githubConnectedOnly || ownerFilter);

  const filterSections: FilterSection[] = [
    { id: "type", label: "Type", kind: "multi", options: TYPE_OPTIONS, selected: type, onChange: (v) => { setType(v); setPage(1); dropSeedParams(); }, allLabel: "All types" },
    { id: "status", label: "Status", kind: "multi", options: STATUS_OPTIONS, selected: status, onChange: (v) => { setStatus(v); setPage(1); dropSeedParams(); }, allLabel: "All statuses" },
    { id: "owner", label: "Owner", kind: "single", options: ownerDropdownOptions, selected: ownerFilter, onChange: (v) => { setOwnerFilter(v); setPage(1); dropSeedParams(); } },
    {
      id: "sort",
      label: "Sort by",
      kind: "single",
      options: SORT_DROPDOWN_OPTIONS,
      selected: sortToPreset(sort) ?? "",
      onChange: (v) => setSort(presetToSort(v)),
      fallbackLabel: "Custom",
    },
  ];
  // Sorting isn't counted as a filter; owner only counts when it differs from where the page started.
  const activeFilterCount = (type.length > 0 ? 1 : 0) + (status.length > 0 ? 1 : 0) + (ownerFilter !== defaultOwner ? 1 : 0);

  function clearFilters() {
    setType([]);
    setStatus([]);
    setOwnerFilter(defaultOwner);
    setPage(1);
    dropSeedParams();
  }

  return (
    <div className="space-y-4">
      <div id="filters" className="scroll-mt-4 flex flex-wrap items-center gap-3">
        {/* Left: search and filters. Right: GitHub toggle and the card/table switch. */}
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:flex-1">
          <div className="w-full sm:w-72">
            <SearchInput
              value={q}
              onChange={updateQuery}
              placeholder={isPage ? "Search projects..." : "Search projects, ideas, and documentation..."}
            />
          </div>
          {!isSearching && <FilterMenu sections={filterSections} activeCount={activeFilterCount} onClear={clearFilters} />}
          {isSearching && (
            <Button variant="ghost" size="sm" icon={X} onClick={() => updateQuery("")}>
              Clear search
            </Button>
          )}
        </div>
        {!isSearching && (
          <div className="flex items-center gap-3 sm:ml-auto">
            <ToggleFilter
              label="GitHub connected"
              checked={githubConnectedOnly}
              onChange={(next) => {
                setGithubConnectedOnly(next);
                setPage(1);
                dropSeedParams();
              }}
              icon={GithubIcon}
              className="sm:w-auto"
            />
            <div className="flex items-center gap-1 rounded-md border border-zinc-300 p-0.5 dark:border-zinc-700">
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
            {isPage && canCreate && (
              <Button href="/projects/new" variant="primary" icon={Plus}>
                New Project
              </Button>
            )}
          </div>
        )}
      </div>

      {isPage && !loading && !loadError && visible.length > 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {visible.length} project{visible.length === 1 ? "" : "s"}
        </p>
      )}

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
        ownerFilter === "me" && type.length === 0 && status.length === 0 && !githubConnectedOnly ? (
          <div className="space-y-3">
            <EmptyState
              icon={SearchX}
              title="You don't own any projects that match."
              description="You're viewing your own projects. Switch to everyone's to browse the rest."
            />
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setOwnerFilter("")}>
                Show all projects
              </Button>
            </div>
          </div>
        ) : hasActiveFilters ? (
          <EmptyState icon={SearchX} title="No projects match your search." description="Try adjusting your filters." />
        ) : (
          <EmptyState
            title="No projects yet."
            description={canCreate ? "Create a project manually or import one from GitHub." : "Projects you own or that are shared with you will appear here."}
            actionHref={canCreate ? "/projects/new" : undefined}
            actionLabel={canCreate ? "New Project" : undefined}
          />
        )
      ) : view === "list" ? (
        <ProjectTable
          projects={shown}
          columns={columns}
          sort={sort}
          onSort={sortByColumn}
          onEditTable={() => setEditingTable(true)}
          onProjectUpdated={(updated) =>
            setProjects((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated, team: p.team } : p)))
          }
        />
      ) : (
        <div className={CARD_GRID_CLASS}>
          {shown.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {isPage && !isSearching && !loading && !loadError && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="pt-2" />
      )}

      {editingTable && (
        <EditTableModal
          open
          onClose={() => setEditingTable(false)}
          columns={columns}
          projects={projects}
          scope={canSetDefaultColumns ? "everyone" : "personal"}
          hasPersonalLayout={personalColumns !== null}
          onSaved={(next) => {
            if (canSetDefaultColumns) {
              setDefaultCols(next);
              savePersonalColumns(null); // the new default replaces any personal layout
            } else {
              savePersonalColumns(next);
            }
          }}
          onResetPersonal={() => savePersonalColumns(null)}
        />
      )}
    </div>
  );
}
