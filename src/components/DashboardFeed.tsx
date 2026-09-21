import Link from "next/link";
import type { Idea } from "@/types/idea";
import type { Insight } from "@/types/insight";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { cn } from "@/lib/cn";
import { LinkPendingHint } from "@/components/LinkPendingHint";

const IDEA_STATUS_LABEL: Record<Idea["status"], string> = {
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  PROMOTED: "Promoted",
  ARCHIVED: "Archived",
};

const IDEA_STATUS_TONE: Record<Idea["status"], string> = {
  ACTIVE: "text-emerald-600 dark:text-emerald-400",
  ON_HOLD: "text-zinc-500 dark:text-zinc-400",
  PROMOTED: "text-orange-600 dark:text-orange-400",
  ARCHIVED: "text-zinc-400 dark:text-zinc-500",
};

const INSIGHT_TYPE_LABEL = {
  new_idea: "New idea",
  improvement: "Improvement",
} as const;

const INSIGHT_TYPE_TONE = {
  new_idea: "text-amber-600 dark:text-amber-400",
  improvement: "text-sky-600 dark:text-sky-400",
} as const;

function FeedHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
      <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h2>
      <Link
        href={href}
        className="text-sm font-medium text-zinc-400 transition-colors hover:text-orange-600 dark:text-zinc-500 dark:hover:text-orange-400"
      >
        View all
      </Link>
    </div>
  );
}

function FeedRow({
  href,
  index,
  title,
  meta,
  metaClassName,
  time,
}: {
  href: string;
  index: number;
  title: string;
  meta: string;
  metaClassName: string;
  time: string;
}) {
  return (
    <li>
      <Link
        href={href}
        prefetch
        className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
      >
        <span className="w-5 shrink-0 text-right text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
          {String(index).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-zinc-900 group-hover:text-zinc-950 dark:text-zinc-50 dark:group-hover:text-white">
          {title}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs">
          <span className={cn("font-medium", metaClassName)}>{meta}</span>
          <span className="text-zinc-400 dark:text-zinc-500">· {time}</span>
          <LinkPendingHint />
        </span>
      </Link>
    </li>
  );
}

export function DashboardFeed({ ideas, insights }: { ideas: Idea[]; insights: Insight[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <FeedHeader title="Recent ideas" href="/ideas" />
        {ideas.length === 0 ? (
          <p className="px-5 py-4 text-sm text-zinc-400">No ideas yet.</p>
        ) : (
          <ol className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {ideas.map((idea, i) => (
              <FeedRow
                key={idea.id}
                href={`/ideas/${idea.id}`}
                index={i + 1}
                title={idea.name}
                meta={IDEA_STATUS_LABEL[idea.status]}
                metaClassName={IDEA_STATUS_TONE[idea.status]}
                time={formatRelativeTime(idea.updatedAt)}
              />
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <FeedHeader title="Recent insights" href="/insights" />
        {insights.length === 0 ? (
          <p className="px-5 py-4 text-sm text-zinc-400">No insights generated yet.</p>
        ) : (
          <ol className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {insights.map((insight, i) => (
              <FeedRow
                key={insight.id}
                href={`/insights#insight-${insight.id}`}
                index={i + 1}
                title={insight.title}
                meta={INSIGHT_TYPE_LABEL[insight.type]}
                metaClassName={INSIGHT_TYPE_TONE[insight.type]}
                time={formatRelativeTime(insight.lastGeneratedAt)}
              />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
