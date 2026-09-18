"use client";

import { useMemo, useState } from "react";
import { Activity, FileText, Info, Link2, Plus } from "lucide-react";
import { GithubIcon } from "@/components/icons/GithubIcon";
import { SearchInput } from "@/components/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/lib/usePagination";
import { formatDate } from "@/lib/formatDate";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { IconType } from "@/components/ui/Button";
import type { ProjectActivity, ProjectActivityType } from "@/types/project";

const ACTIVITY_ICONS: Record<ProjectActivityType, IconType> = {
  PROJECT_CREATED: Plus,
  PROJECT_UPDATED: Info,
  GITHUB_SYNCED: GithubIcon,
  DOCUMENTATION_UPDATED: FileText,
  DEPLOYMENT_UPDATED: Link2,
};

const PAGE_SIZE = 5;

export function ActivityList({ activities }: { activities: ProjectActivity[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activities;
    return activities.filter((item) => item.title.toLowerCase().includes(q));
  }, [activities, query]);

  const { pageItems, page, setPage, totalPages } = usePagination(filtered, PAGE_SIZE);

  if (activities.length === 0) {
    return <p className="text-sm text-zinc-400">No activity yet</p>;
  }

  return (
    <div className="space-y-3">
      {activities.length > PAGE_SIZE && (
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          placeholder="Search activity..."
        />
      )}

      {pageItems.length === 0 ? (
        <p className="text-sm text-zinc-400">No matching activity</p>
      ) : (
        <ul className="space-y-2.5">
          {pageItems.map((item) => {
            const Icon = ACTIVITY_ICONS[item.type] ?? Activity;
            return (
              <li key={item.id} className="flex items-start gap-2.5 text-sm">
                <Icon size={14} className="mt-0.5 shrink-0 text-zinc-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-zinc-800 dark:text-zinc-200">{item.title}</p>
                  <p className="text-xs text-zinc-400" title={formatDate(item.createdAt)}>
                    {formatRelativeTime(item.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
