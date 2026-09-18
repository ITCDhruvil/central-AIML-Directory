"use client";

import { Suspense, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { CircleCheck, LayoutGrid, List, Plus, SlidersHorizontal } from "lucide-react";
import { ProjectCard } from "@/components/ProjectCard";
import { ProjectListRow } from "@/components/ProjectListRow";
import { SearchInput } from "@/components/SearchInput";
import { EmptyState } from "@/components/EmptyState";
import { Dropdown } from "@/components/ui/Dropdown";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { CARD_GRID_CLASS } from "@/components/ContentCard";
import { usePagination } from "@/lib/usePagination";
import { cn } from "@/lib/cn";
import { PROJECT_STATUSES, PROJECT_TYPES, type Project } from "@/types/project";
import { STATUS_ICONS, TYPE_ICONS } from "@/lib/projectOptionIcons";
import { applyClientFilters } from "@/lib/projectExplorer";

type ViewMode = "grid" | "list";
const PAGE_SIZE = 9;

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  ...PROJECT_TYPES.map((t) => ({ value: t, label: t, icon: TYPE_ICONS[t].icon, iconClassName: TYPE_ICONS[t].className })),
];
const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  ...PROJECT_STATUSES.map((s) => ({ value: s, label: s, icon: STATUS_ICONS[s].icon, iconClassName: STATUS_ICONS[s].className })),
];

export default function ProjectsPage() {
  return (
    <Suspense fallback={<SkeletonCardGrid />}>
      <ProjectsPageContent />
    </Suspense>
  );
}

function ProjectsPageContent() {
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, startTransition] = useTransition();
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [type, setType] = useState(() => searchParams.get("type") ?? "");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "");
  const githubOnly = searchParams.get("github") === "1";
  const [view, setView] = useState<ViewMode>("grid");
  const visible = useMemo(
    () => applyClientFilters(projects, { githubConnectedOnly: githubOnly }),
    [projects, githubOnly],
  );
  const { pageItems, page, setPage, totalPages } = usePagination(visible, PAGE_SIZE);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    if (status) params.set("status", status);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/projects?${params.toString()}`, { signal: controller.signal });
        const body = await res.json();
        setProjects(body.projects ?? []);
        setPage(1);
      } catch (err) {
        if (!(err instanceof Error) || err.name !== "AbortError") console.error(err);
      }
    });

    return () => controller.abort();
  }, [q, type, status, setPage]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Projects</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Your personal engineering projects and experiments.</p>
      </div>

      <div id="filters" className="flex flex-col gap-3 scroll-mt-4 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="sm:min-w-64 sm:flex-1">
          <SearchInput value={q} onChange={setQ} placeholder="Search projects..." />
        </div>
        <Dropdown value={type} onChange={setType} options={TYPE_OPTIONS} aria-label="Filter by type" icon={SlidersHorizontal} className="sm:w-40" />
        <Dropdown value={status} onChange={setStatus} options={STATUS_OPTIONS} aria-label="Filter by status" icon={CircleCheck} className="sm:w-40" />
        <Button href="/projects/new" variant="primary" icon={Plus}>
          New Project
        </Button>
        <div className="flex items-center gap-1 rounded-md border border-zinc-300 p-0.5 dark:border-zinc-700 sm:ml-auto">
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
      </div>

      {loading ? (
        <SkeletonCardGrid />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No projects found"
          description="Try adjusting your search or filters, or add a new project."
          actionHref="/projects/new"
          actionLabel="Add Project"
        />
      ) : (
        <>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {visible.length} project{visible.length === 1 ? "" : "s"}
          </p>
          {view === "list" ? (
            <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 [&>*:first-child]:rounded-t-lg [&>*:last-child]:rounded-b-lg dark:divide-zinc-800 dark:border-zinc-800">
              {pageItems.map((project) => (
                <ProjectListRow key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className={CARD_GRID_CLASS}>
              {pageItems.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="pt-2" />
        </>
      )}
    </div>
  );
}
