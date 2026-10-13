"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Box, ChevronsUpDown, Clock, ExternalLink, Pencil } from "lucide-react";
import { GithubIcon } from "@/components/icons/GithubIcon";
import { ProjectCardMenu } from "@/components/ProjectCardMenu";
import { ProjectTypeIcon } from "@/components/ProjectTypeIcon";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { EmptyCellAdd } from "@/components/EmptyCellAdd";
import { saveProjectFields } from "@/lib/saveProjectFields";
import { isEditableWhenEmpty } from "@/lib/projectCellEdit";
import { COLUMN_META, ownerOptions, type ColumnId, type SortState } from "@/lib/projectTable";
import { stripMarkdown } from "@/lib/stripMarkdown";
import type { Project, ProjectStatus } from "@/types/project";

const CHIP_TONES = [
  "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
  "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
];

/** Same technology, same colour everywhere: picked from its name, not its position. */
export function toneFor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CHIP_TONES[hash % CHIP_TONES.length];
}

const STATUS_PILL: Record<ProjectStatus, { label: string; pill: string; dot: string }> = {
  ACTIVE: { label: "Active", pill: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400", dot: "bg-green-500" },
  COMPLETED: { label: "Completed", pill: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300", dot: "bg-violet-500" },
  ON_HOLD: { label: "On Hold", pill: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300", dot: "bg-orange-500" },
  ARCHIVED: { label: "Archived", pill: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", dot: "bg-zinc-400" },
};

const TYPE_LABEL: Record<Project["type"], string> = { PROJECT: "Project", POC: "POC", EXPERIMENT: "Experiment", TOOL: "Tool", OTHER: "Other" };

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
}

function Empty() {
  return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
}

function When({ iso }: { iso: string | null }) {
  if (!iso) return <Empty />;
  return (
    <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
      <Clock size={14} className="shrink-0 text-zinc-400" />
      <span suppressHydrationWarning>{formatRelativeTime(iso)}</span>
    </span>
  );
}

function Cell({
  project,
  column,
  ownerSuggestions,
  onProjectUpdated,
}: {
  project: Project;
  column: ColumnId;
  ownerSuggestions: string[];
  onProjectUpdated: (updated: Project) => void;
}) {
  // A blank value becomes "+ Add" for fields that can be filled in here, and a dash for the rest.
  const blank = () =>
    isEditableWhenEmpty(column) ? (
      <EmptyCellAdd
        name={project.name}
        resource="projects"
        column={column}
        ownerSuggestions={ownerSuggestions}
        onSave={async (patch) => {
          try {
            onProjectUpdated(await saveProjectFields(project.id, patch));
          } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to save";
            throw new Error(message === "Project not found" ? "You can't edit this project." : message);
          }
        }}
      />
    ) : (
      <Empty />
    );

  switch (column) {
    case "name":
      return (
        <div className="flex min-w-0 items-center gap-3.5">
          <ProjectTypeIcon name={project.name} description={project.description} technologies={project.technologies} size={46} />
          <div className="min-w-0">
            <Link
              href={`/projects/${project.id}`}
              className="block truncate text-[15px] font-semibold text-zinc-900 hover:text-orange-600 dark:text-zinc-100 dark:hover:text-orange-400"
            >
              {project.name}
            </Link>
            {project.description && (
              <p className="truncate text-[13px] text-zinc-500 dark:text-zinc-400">{stripMarkdown(project.description)}</p>
            )}
          </div>
        </div>
      );
    case "technologies": {
      const shown = project.technologies.slice(0, 3);
      const extra = project.technologies.length - shown.length;
      if (shown.length === 0) return blank();
      return (
        <div className="flex flex-nowrap items-center gap-1.5 overflow-hidden">
          {shown.map((t) => (
            <span key={t.name} className={cn("shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", toneFor(t.name))}>
              {t.name}
            </span>
          ))}
          {extra > 0 && <span className="text-xs font-medium text-zinc-400">+{extra}</span>}
        </div>
      );
    }
    case "type":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <Box size={13} className="text-zinc-400" />
          {TYPE_LABEL[project.type]}
        </span>
      );
    case "status": {
      const s = STATUS_PILL[project.status];
      return (
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", s.pill)}>
          <span className={cn("h-2 w-2 rounded-full", s.dot)} />
          {s.label}
        </span>
      );
    }
    case "stage":
      return project.stage ? (
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {titleCase(project.stage)}
        </span>
      ) : (
        blank()
      );
    case "owner": {
      // The team when there is one (Owners first); otherwise the free-text owner.
      const people = project.team && project.team.length > 0 ? project.team.map((m) => m.name) : project.owner ? [project.owner] : [];
      if (people.length === 0) return blank();
      const shown = people.slice(0, 3);
      return (
        <span className="inline-flex min-w-0 items-center gap-2 text-zinc-700 dark:text-zinc-200" title={people.join(", ")}>
          <span className="flex shrink-0 -space-x-1.5">
            {shown.map((name) => (
              <span
                key={name}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-50 text-[10px] font-semibold text-orange-700 ring-2 ring-white dark:bg-orange-500/20 dark:text-orange-300 dark:ring-zinc-900"
              >
                {name.trim().charAt(0).toUpperCase()}
              </span>
            ))}
          </span>
          <span className="truncate">{people[0]}</span>
          {people.length > 1 && <span className="shrink-0 text-xs text-zinc-400">+{people.length - 1}</span>}
        </span>
      );
    }
    case "tags":
      return project.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {project.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {tag}
            </span>
          ))}
          {project.tags.length > 3 && <span className="text-[11px] text-zinc-400">+{project.tags.length - 3}</span>}
        </div>
      ) : (
        blank()
      );
    case "github":
      return project.githubUrl ? (
        <a
          href={project.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 items-center gap-1.5 text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
        >
          <GithubIcon size={14} className="shrink-0" />
          <span className="truncate">{project.githubRepo ?? "GitHub"}</span>
        </a>
      ) : (
        blank()
      );
    case "deployment": {
      const url = project.deploymentUrls[0];
      if (!url) return blank();
      let host = url;
      try {
        host = new URL(url).hostname;
      } catch {
        // keep the raw value
      }
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 items-center gap-1.5 text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
        >
          <ExternalLink size={13} className="shrink-0" />
          <span className="truncate">{host}</span>
        </a>
      );
    }
    case "branch":
      return project.defaultBranch ? <code className="font-mono text-xs text-zinc-600 dark:text-zinc-300">{project.defaultBranch}</code> : blank();
    case "updated":
      return <When iso={project.updatedAt} />;
    case "created":
      return <When iso={project.createdAt} />;
    case "synced":
      return <When iso={project.lastSyncedAt} />;
  }
}

function SortHeader({ column, sort, onSort }: { column: ColumnId; sort: SortState; onSort: (column: ColumnId) => void }) {
  const active = sort.column === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        "group inline-flex items-center gap-1 rounded-md py-1 text-left text-xs font-semibold transition-colors",
        active ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
      )}
    >
      {COLUMN_META[column].label}
      {active ? (
        sort.dir === "asc" ? <ArrowUp size={13} className="text-orange-600" /> : <ArrowDown size={13} className="text-orange-600" />
      ) : (
        <ChevronsUpDown size={13} className="text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-600" />
      )}
    </button>
  );
}

function EditTableButton({ onEditTable }: { onEditTable: () => void }) {
  return (
    <button
      type="button"
      aria-label="Edit table columns"
      title="Edit table"
      onClick={onEditTable}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-orange-600 dark:hover:bg-zinc-800 dark:hover:text-orange-400"
    >
      <Pencil size={16} />
    </button>
  );
}

/**
 * Projects as a sortable table. Click a column header to sort by it (click again to flip direction).
 * The pencil in the last header cell lets anyone choose which columns are shown.
 */
export function ProjectTable({
  projects,
  columns,
  sort,
  onSort,
  onEditTable,
  onProjectUpdated,
}: {
  projects: Project[];
  columns: ColumnId[];
  sort: SortState;
  onSort: (column: ColumnId) => void;
  onEditTable: () => void;
  /** Called with the saved project when a blank cell is filled in, so the row updates without a reload. */
  onProjectUpdated: (updated: Project) => void;
}) {
  const ownerSuggestions = ownerOptions(projects);
  // Project column gets more room; the rest share evenly. The last track holds the row menu.
  const WIDTHS: Partial<Record<ColumnId, string>> = {
    name: "minmax(240px,2.2fr)",
    technologies: "minmax(250px,2fr)",
    tags: "minmax(160px,1.4fr)",
    owner: "minmax(140px,1.2fr)",
  };
  const template = columns.map((c) => WIDTHS[c] ?? "minmax(110px,1fr)").join(" ") + " 44px";

  return (
    // Horizontal scroll only on small screens, so row menus on md+ aren't clipped by the scroll box.
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.03)] dark:border-zinc-800 dark:bg-zinc-900 md:overflow-visible">
      <div role="table" className="min-w-[760px] md:min-w-0">
        <div
          role="row"
          className="grid items-center gap-x-4 border-b border-zinc-100 px-5 py-2.5 dark:border-zinc-800"
          style={{ gridTemplateColumns: template }}
        >
          {columns.map((column) => (
            <div
              key={column}
              role="columnheader"
              aria-sort={sort.column === column ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
            >
              <SortHeader column={column} sort={sort} onSort={onSort} />
            </div>
          ))}
          <div role="columnheader" aria-label="Edit table" className="flex justify-end">
            <EditTableButton onEditTable={onEditTable} />
          </div>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {projects.map((project) => (
            <div
              key={project.id}
              role="row"
              className="grid items-center gap-x-4 px-5 py-4 text-sm transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40"
              style={{ gridTemplateColumns: template }}
            >
              {columns.map((column) => (
                <div key={column} role="cell" className="min-w-0">
                  <Cell project={project} column={column} ownerSuggestions={ownerSuggestions} onProjectUpdated={onProjectUpdated} />
                </div>
              ))}
              <div role="cell" className="flex justify-end">
                <ProjectCardMenu id={project.id} name={project.name} githubUrl={project.githubUrl} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
