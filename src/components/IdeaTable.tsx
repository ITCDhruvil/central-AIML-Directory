"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown, Clock } from "lucide-react";
import { EmptyCellAdd } from "@/components/EmptyCellAdd";
import { IdeaCardMenu } from "@/components/IdeaCardMenu";
import { GlowBulbIcon } from "@/components/icons/GlowBulbIcon";
import { toneFor } from "@/components/ProjectTable";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { IdeaColumn, IdeaSort } from "@/lib/ideaExplorer";
import { saveIdeaFields } from "@/lib/saveIdeaFields";
import { stripMarkdown } from "@/lib/stripMarkdown";
import type { Idea, IdeaStatus } from "@/types/idea";

const COLUMNS: { id: IdeaColumn; label: string; width: string }[] = [
  { id: "name", label: "Idea", width: "minmax(220px,2.2fr)" },
  { id: "status", label: "Status", width: "minmax(100px,1fr)" },
  { id: "owner", label: "Owner", width: "minmax(130px,1.2fr)" },
  { id: "technologies", label: "Technologies", width: "minmax(180px,2fr)" },
  { id: "tags", label: "Tags", width: "minmax(130px,1.4fr)" },
  { id: "updated", label: "Updated", width: "minmax(100px,1fr)" },
];

// The same pills as the project table, so the two pages read alike.
const STATUS_PILL: Record<
  IdeaStatus,
  { label: string; pill: string; dot: string }
> = {
  ACTIVE: {
    label: "Active",
    pill: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
    dot: "bg-green-500",
  },
  ON_HOLD: {
    label: "On Hold",
    pill: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  PROMOTED: {
    label: "Promoted",
    pill: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  ARCHIVED: {
    label: "Archived",
    pill: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    dot: "bg-zinc-400",
  },
};

/** Container width at which all six columns fit. */
const FULL_WIDTH = 1060;

const Empty = () => <span className="text-zinc-300 dark:text-zinc-600">—</span>;

function Cell({
  idea,
  column,
  ownerSuggestions,
  onIdeaUpdated,
}: {
  idea: Idea;
  column: IdeaColumn;
  ownerSuggestions: string[];
  onIdeaUpdated: (updated: Idea) => void;
}) {
  // A blank owner, technologies or tags cell becomes "+ Add" (for people who can edit ideas); anything else is a dash.
  const blank = () =>
    column === "owner" || column === "technologies" || column === "tags" ? (
      <EmptyCellAdd
        name={idea.name}
        resource="ideas"
        column={column}
        ownerSuggestions={ownerSuggestions}
        onSave={async (patch) =>
          onIdeaUpdated(await saveIdeaFields(idea.id, patch))
        }
      />
    ) : (
      <Empty />
    );

  switch (column) {
    case "name":
      return (
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400">
            <GlowBulbIcon size={22} />
          </span>
          <div className="min-w-0">
            <Link
              href={`/ideas/${idea.id}`}
              className="block truncate text-[15px] font-semibold text-zinc-900 hover:text-orange-600 dark:text-zinc-100 dark:hover:text-orange-400"
            >
              {idea.name}
            </Link>
            {idea.description && (
              <p className="truncate text-[13px] text-zinc-500 dark:text-zinc-400">
                {stripMarkdown(idea.description)}
              </p>
            )}
          </div>
        </div>
      );
    case "status": {
      const s = STATUS_PILL[idea.status];
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            s.pill,
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", s.dot)} />
          {s.label}
        </span>
      );
    }
    case "owner":
      return idea.owner ? (
        <span
          className="inline-flex min-w-0 items-center gap-2 text-zinc-700 dark:text-zinc-200"
          title={idea.owner}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[10px] font-semibold text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
            {idea.owner.trim().charAt(0).toUpperCase()}
          </span>
          <span className="truncate">{idea.owner}</span>
        </span>
      ) : (
        blank()
      );
    case "technologies": {
      const shown = idea.technologies.slice(0, 3);
      const extra = idea.technologies.length - shown.length;
      if (shown.length === 0) return blank();
      return (
        <div className="flex flex-nowrap items-center gap-1.5 overflow-hidden">
          {shown.map((t) => (
            <span
              key={t.name}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
                toneFor(t.name),
              )}
            >
              {t.name}
            </span>
          ))}
          {extra > 0 && (
            <span className="text-xs font-medium text-zinc-400">+{extra}</span>
          )}
        </div>
      );
    }
    case "tags":
      return idea.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {idea.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {tag}
            </span>
          ))}
          {idea.tags.length > 3 && (
            <span className="text-[11px] text-zinc-400">
              +{idea.tags.length - 3}
            </span>
          )}
        </div>
      ) : (
        blank()
      );
    case "updated":
      return (
        <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
          <Clock size={14} className="shrink-0 text-zinc-400" />
          <span suppressHydrationWarning>
            {formatRelativeTime(idea.updatedAt)}
          </span>
        </span>
      );
  }
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: IdeaColumn;
  sort: IdeaSort;
  onSort: (column: IdeaColumn) => void;
}) {
  const active = sort.column === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        "group inline-flex items-center gap-1 rounded-md py-1 text-left text-xs font-semibold transition-colors",
        active
          ? "text-zinc-900 dark:text-zinc-50"
          : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
      )}
    >
      {label}
      {active ? (
        sort.dir === "asc" ? (
          <ArrowUp size={13} className="text-orange-600" />
        ) : (
          <ArrowDown size={13} className="text-orange-600" />
        )
      ) : (
        <ChevronsUpDown
          size={13}
          className="text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-600"
        />
      )}
    </button>
  );
}

/** Ideas as a sortable table, laid out like the project table. Click a column header to sort by it. */
export function IdeaTable({
  ideas,
  sort,
  onSort,
  ownerSuggestions,
  onIdeaUpdated,
}: {
  ideas: Idea[];
  sort: IdeaSort;
  onSort: (column: IdeaColumn) => void;
  /** Every owner name known on the page, offered when filling in an empty Owner cell. */
  ownerSuggestions: string[];
  /** Called with the saved idea after a blank cell is filled in, so the row updates without a reload. */
  onIdeaUpdated: (updated: Idea) => void;
}) {
  // All six columns need about 1060px. Narrower than that, Tags steps aside so the page never scrolls sideways.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWide(entry.contentRect.width >= FULL_WIDTH),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const columns = wide ? COLUMNS : COLUMNS.filter((c) => c.id !== "tags");
  const template = columns.map((c) => c.width).join(" ") + " 44px";

  return (
    // Horizontal scroll only on small screens, so row menus on md+ aren't clipped by the scroll box.
    <div
      ref={wrapRef}
      className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.03)] dark:border-zinc-800 dark:bg-zinc-900 md:overflow-visible"
    >
      <div role="table" className="min-w-[760px] md:min-w-0">
        <div
          role="row"
          className="grid items-center gap-x-4 border-b border-zinc-100 px-5 py-2.5 dark:border-zinc-800"
          style={{ gridTemplateColumns: template }}
        >
          {columns.map((c) => (
            <div
              key={c.id}
              role="columnheader"
              aria-sort={
                sort.column === c.id
                  ? sort.dir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              <SortHeader
                label={c.label}
                column={c.id}
                sort={sort}
                onSort={onSort}
              />
            </div>
          ))}
          <div role="columnheader" aria-label="Actions" />
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {ideas.map((idea) => (
            <div
              key={idea.id}
              role="row"
              className="grid items-center gap-x-4 px-5 py-4 text-sm transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40"
              style={{ gridTemplateColumns: template }}
            >
              {columns.map((c) => (
                <div key={c.id} role="cell" className="min-w-0">
                  <Cell
                    idea={idea}
                    column={c.id}
                    ownerSuggestions={ownerSuggestions}
                    onIdeaUpdated={onIdeaUpdated}
                  />
                </div>
              ))}
              <div role="cell" className="flex justify-end">
                <IdeaCardMenu
                  id={idea.id}
                  name={idea.name}
                  promoted={idea.status === "PROMOTED"}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
