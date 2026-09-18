"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { CircleCheck, LayoutGrid, List, Plus } from "lucide-react";
import { IdeaCard } from "@/components/IdeaCard";
import { IdeaListRow } from "@/components/IdeaListRow";
import { SearchInput } from "@/components/SearchInput";
import { EmptyState } from "@/components/EmptyState";
import { Dropdown } from "@/components/ui/Dropdown";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { CARD_GRID_CLASS } from "@/components/ContentCard";
import { usePagination } from "@/lib/usePagination";
import { cn } from "@/lib/cn";
import { IDEA_STATUSES, type Idea } from "@/types/idea";
import { IDEA_STATUS_ICONS } from "@/lib/ideaOptionIcons";

type ViewMode = "grid" | "list";
const PAGE_SIZE = 9;

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  ...IDEA_STATUSES.map((s) => ({ value: s, label: s, icon: IDEA_STATUS_ICONS[s].icon, iconClassName: IDEA_STATUS_ICONS[s].className })),
];

export default function IdeasPage() {
  return (
    <Suspense fallback={<SkeletonCardGrid />}>
      <IdeasPageContent />
    </Suspense>
  );
}

function IdeasPageContent() {
  const searchParams = useSearchParams();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, startTransition] = useTransition();
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "");
  const [view, setView] = useState<ViewMode>("grid");
  const { pageItems, page, setPage, totalPages } = usePagination(ideas, PAGE_SIZE);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/ideas?${params.toString()}`, { signal: controller.signal });
        const body = await res.json();
        setIdeas(body.ideas ?? []);
        setPage(1);
      } catch (err) {
        if (!(err instanceof Error) || err.name !== "AbortError") console.error(err);
      }
    });

    return () => controller.abort();
  }, [q, status, setPage]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Ideas</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Problems worth solving, before they become projects.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="sm:min-w-64 sm:flex-1">
          <SearchInput value={q} onChange={setQ} placeholder="Search ideas..." />
        </div>
        <Dropdown value={status} onChange={setStatus} options={STATUS_OPTIONS} aria-label="Filter by status" icon={CircleCheck} className="sm:w-40" />
        <Button href="/ideas/new" variant="primary" icon={Plus}>
          New Idea
        </Button>
        <div className="flex items-center gap-1 rounded-md border border-zinc-300 p-0.5 dark:border-zinc-700 sm:ml-auto">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded",
              view === "grid" ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
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
              view === "list" ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
            )}
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <SkeletonCardGrid />
      ) : ideas.length === 0 ? (
        <EmptyState
          title="No ideas yet"
          description="Capture a problem worth solving — you can promote it to a full project later."
          actionHref="/ideas/new"
          actionLabel="Add Idea"
        />
      ) : (
        <>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {ideas.length} idea{ideas.length === 1 ? "" : "s"}
          </p>
          {view === "list" ? (
            <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 [&>*:first-child]:rounded-t-lg [&>*:last-child]:rounded-b-lg dark:divide-zinc-800 dark:border-zinc-800">
              {pageItems.map((idea) => (
                <IdeaListRow key={idea.id} idea={idea} />
              ))}
            </div>
          ) : (
            <div className={CARD_GRID_CLASS}>
              {pageItems.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} />
              ))}
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="pt-2" />
        </>
      )}
    </div>
  );
}
