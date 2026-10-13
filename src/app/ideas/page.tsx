"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, LayoutGrid, List, Plus, SearchX } from "lucide-react";
import { useCan } from "@/components/AuthProvider";
import { IdeaCard } from "@/components/IdeaCard";
import { IdeaTable } from "@/components/IdeaTable";
import { SearchInput } from "@/components/SearchInput";
import { EmptyState } from "@/components/EmptyState";
import { FilterMenu, type FilterSection } from "@/components/ui/FilterMenu";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { CARD_GRID_CLASS } from "@/components/ContentCard";
import { usePagination } from "@/lib/usePagination";
import { cn } from "@/lib/cn";
import {
  DEFAULT_IDEA_SORT,
  IDEA_SORT_PRESETS,
  filterIdeas,
  ideaOwnerOptions,
  ideaSortToPreset,
  sortIdeas,
  toggleIdeaSort,
  type IdeaColumn,
  type IdeaSort,
} from "@/lib/ideaExplorer";
import { IDEA_STATUSES, type Idea, type IdeaStatus } from "@/types/idea";
import { IDEA_STATUS_ICONS } from "@/lib/ideaOptionIcons";

type ViewMode = "grid" | "list";

const STATUS_OPTIONS = IDEA_STATUSES.map((s) => ({
  value: s,
  label: s.charAt(0) + s.slice(1).toLowerCase().replace("_", " "),
  icon: IDEA_STATUS_ICONS[s].icon,
  iconClassName: IDEA_STATUS_ICONS[s].className,
}));
const SORT_OPTIONS = Object.entries(IDEA_SORT_PRESETS).map(([value, p]) => ({
  value,
  label: p.label,
}));

export default function IdeasPage() {
  return (
    <Suspense fallback={<SkeletonCardGrid />}>
      <IdeasPageContent />
    </Suspense>
  );
}

function IdeasPageContent() {
  const canCreate = useCan("ideas", "create");
  const searchParams = useSearchParams();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);

  // Same shape as the Projects page: search and filters narrow the list on this page, instantly.
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [statuses, setStatuses] = useState<IdeaStatus[]>(() => {
    const seed = searchParams.get("status");
    return seed && (IDEA_STATUSES as readonly string[]).includes(seed)
      ? [seed as IdeaStatus]
      : [];
  });
  const [owner, setOwner] = useState("");
  const [sort, setSort] = useState<IdeaSort>(DEFAULT_IDEA_SORT);
  const [view, setView] = useState<ViewMode>("list");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ideas", { signal: controller.signal })
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(String(res.status))),
      )
      .then((body: { ideas?: Idea[] }) => {
        setIdeas(body.ideas ?? []);
        setLoadError(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);

  const owners = useMemo(() => ideaOwnerOptions(ideas), [ideas]);
  const visible = useMemo(
    () => sortIdeas(filterIdeas(ideas, { query: q, statuses, owner }), sort),
    [ideas, q, statuses, owner, sort],
  );
  const { pageItems, page, setPage, totalPages } = usePagination(
    visible,
    view === "grid" ? 9 : 10,
  );

  const activeFilterCount =
    (statuses.length > 0 ? 1 : 0) + (owner !== "" ? 1 : 0);

  const filterSections: FilterSection[] = [
    {
      id: "status",
      label: "Status",
      kind: "multi",
      options: STATUS_OPTIONS,
      selected: statuses,
      onChange: (next) => {
        setStatuses(next as IdeaStatus[]);
        setPage(1);
      },
      allLabel: "All statuses",
    },
    {
      id: "owner",
      label: "Owner",
      kind: "single",
      options: [
        { value: "", label: "All owners" },
        ...owners.map((name) => ({ value: name, label: name })),
      ],
      selected: owner,
      onChange: (next) => {
        setOwner(next);
        setPage(1);
      },
    },
    {
      id: "sort",
      label: "Sort by",
      kind: "single",
      options: SORT_OPTIONS,
      selected: ideaSortToPreset(sort) ?? "",
      fallbackLabel: "Custom",
      onChange: (next) => {
        setSort(IDEA_SORT_PRESETS[next]?.sort ?? DEFAULT_IDEA_SORT);
        setPage(1);
      },
    },
  ];

  function clearFilters() {
    setStatuses([]);
    setOwner("");
    setPage(1);
  }

  function onSort(column: IdeaColumn) {
    setSort((current) => toggleIdeaSort(current, column));
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Ideas
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Problems worth solving, before they become projects.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Left: search and filters. Right: the card/table switch and New Idea, like the Projects page. */}
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:flex-1">
            <div className="w-full sm:w-72">
              <SearchInput
                value={q}
                onChange={(next) => {
                  setQ(next);
                  setPage(1);
                }}
                placeholder="Search ideas..."
              />
            </div>
            <FilterMenu
              sections={filterSections}
              activeCount={activeFilterCount}
              onClear={clearFilters}
            />
          </div>

          <div className="flex items-center gap-3 sm:ml-auto">
            <div className="flex items-center gap-1 rounded-md border border-zinc-300 p-0.5 dark:border-zinc-700">
              {(
                [
                  ["grid", "Grid view", LayoutGrid],
                  ["list", "List view", List],
                ] as const
              ).map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  aria-label={label}
                  aria-pressed={view === mode}
                  onClick={() => {
                    setView(mode);
                    setPage(1);
                  }}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded",
                    view === mode
                      ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
                      : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                  )}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
            {canCreate && (
              <Button href="/ideas/new" variant="primary" icon={Plus}>
                New Idea
              </Button>
            )}
          </div>
        </div>

        {!loading && !loadError && visible.length > 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {visible.length} idea{visible.length === 1 ? "" : "s"}
          </p>
        )}

        {loading ? (
          <SkeletonCardGrid />
        ) : loadError ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-red-300 px-6 py-10 text-center text-sm text-red-600 dark:border-red-900 dark:text-red-400">
            <AlertCircle size={20} />
            <p>Unable to load ideas.</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLoading(true);
                setRetry((n) => n + 1);
              }}
              className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
            >
              Try again
            </Button>
          </div>
        ) : ideas.length === 0 ? (
          <EmptyState
            title="No ideas yet"
            description={
              canCreate
                ? "Capture a problem worth solving — you can promote it to a full project later."
                : "Ideas you own or that are shared with you will appear here."
            }
            actionHref={canCreate ? "/ideas/new" : undefined}
            actionLabel={canCreate ? "Add Idea" : undefined}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No ideas match"
            description="Try a different search, or clear the filters to see every idea."
          />
        ) : (
          <>
            {view === "list" ? (
              <IdeaTable
                ideas={pageItems}
                sort={sort}
                onSort={onSort}
                ownerSuggestions={owners}
                onIdeaUpdated={(updated) =>
                  setIdeas((prev) =>
                    prev.map((i) => (i.id === updated.id ? updated : i)),
                  )
                }
              />
            ) : (
              <div className={CARD_GRID_CLASS}>
                {pageItems.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} />
                ))}
              </div>
            )}
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              className="pt-2"
            />
          </>
        )}
      </div>
    </div>
  );
}
