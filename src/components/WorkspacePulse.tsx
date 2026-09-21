import Link from "next/link";
import { cn } from "@/lib/cn";
import type { PortfolioSnapshot } from "@/lib/portfolioSnapshot";
import type { IdeasSnapshot, InsightsPulse } from "@/lib/workspaceSnapshot";
import type { ProjectStatus } from "@/types/project";
import type { IdeaStatus } from "@/types/idea";
import { formatDate } from "@/lib/formatDate";

const PROJECT_STATUS_ORDER: ProjectStatus[] = ["ACTIVE", "COMPLETED", "ON_HOLD", "ARCHIVED"];

const PROJECT_STATUS_COPY: Record<ProjectStatus, { label: string; href: string; bar: string }> = {
  ACTIVE: { label: "in motion", href: "/projects?status=ACTIVE", bar: "bg-orange-600 dark:bg-orange-500" },
  COMPLETED: { label: "completed", href: "/projects?status=COMPLETED", bar: "bg-zinc-400 dark:bg-zinc-500" },
  ON_HOLD: { label: "on hold", href: "/projects?status=ON_HOLD", bar: "bg-zinc-300 dark:bg-zinc-600" },
  ARCHIVED: { label: "archived", href: "/projects?status=ARCHIVED", bar: "bg-zinc-200 dark:bg-zinc-700" },
};

const IDEA_STATUS_ORDER: IdeaStatus[] = ["ACTIVE", "PROMOTED", "ON_HOLD", "ARCHIVED"];

const IDEA_STATUS_COPY: Record<IdeaStatus, { label: string; href: string; bar: string }> = {
  ACTIVE: { label: "active", href: "/ideas?status=ACTIVE", bar: "bg-orange-600 dark:bg-orange-500" },
  PROMOTED: { label: "promoted", href: "/ideas?status=PROMOTED", bar: "bg-zinc-400 dark:bg-zinc-500" },
  ON_HOLD: { label: "on hold", href: "/ideas?status=ON_HOLD", bar: "bg-zinc-300 dark:bg-zinc-600" },
  ARCHIVED: { label: "archived", href: "/ideas?status=ARCHIVED", bar: "bg-zinc-200 dark:bg-zinc-700" },
};

type MixItem = { key: string; count: number; label: string; href: string; bar: string };

function countPhrase(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

function PulseCard({
  href,
  total,
  caption,
  empty,
  mix,
  footer,
}: {
  href: string;
  total: number;
  caption: string;
  empty: string;
  mix: MixItem[];
  footer?: React.ReactNode;
}) {
  const visibleMix = mix.filter((item) => item.count > 0);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-900">
      <Link href={href} className="block hover:opacity-90">
        <p className="text-5xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">{total}</p>
        <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">{caption}</p>
      </Link>

      <div className="mt-5">
        {total === 0 ? (
          <p className="text-sm text-zinc-400">{empty}</p>
        ) : (
          <>
            <div className="flex h-2 overflow-hidden rounded-sm bg-zinc-100 dark:bg-zinc-800" aria-hidden="true">
              {visibleMix.map((item) => (
                <span key={item.key} className={cn("h-full min-w-1", item.bar)} style={{ flexGrow: item.count }} />
              ))}
            </div>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {visibleMix.map((item, i) => (
                <span key={item.key}>
                  {i > 0 ? ", " : ""}
                  <Link href={item.href} className="hover:text-zinc-800 dark:hover:text-zinc-200">
                    {item.count} {item.label}
                  </Link>
                </span>
              ))}
            </p>
          </>
        )}
      </div>

      {footer ? (
        <div className="mt-5 border-t border-zinc-100 pt-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

function ProjectsPulse({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const { total, byStatus, github, reachable, internal, poc } = snapshot;
  const mix: MixItem[] = PROJECT_STATUS_ORDER.map((status) => ({
    key: status,
    count: byStatus[status],
    ...PROJECT_STATUS_COPY[status],
  }));

  return (
    <PulseCard
      href="/projects"
      total={total}
      caption={total === 1 ? "project in the directory" : "projects in the directory"}
      empty="No projects yet."
      mix={mix}
      footer={
        total > 0 ? (
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              <Link href="/projects?github=1" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                {github === total ? "All on GitHub" : `${github} of ${total} on GitHub`}
              </Link>
            </li>
            <li>
              {reachable === 0
                ? "None with a live URL"
                : reachable === total
                  ? "All have a live URL"
                  : `${countPhrase(reachable, "project", "projects")} with a live URL`}
              {internal > 0 && ` (${countPhrase(internal, "internal", "internal")})`}
            </li>
            <li>
              {poc === 0 ? (
                "No POCs"
              ) : (
                <Link href="/projects?type=POC" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                  {countPhrase(poc, "POC", "POCs")}
                </Link>
              )}
            </li>
          </ul>
        ) : null
      }
    />
  );
}

function IdeasPulse({ snapshot }: { snapshot: IdeasSnapshot }) {
  const mix: MixItem[] = IDEA_STATUS_ORDER.map((status) => ({
    key: status,
    count: snapshot.byStatus[status],
    ...IDEA_STATUS_COPY[status],
  }));

  return (
    <PulseCard
      href="/ideas"
      total={snapshot.total}
      caption={snapshot.total === 1 ? "idea in the pipeline" : "ideas in the pipeline"}
      empty="No ideas yet."
      mix={mix}
      footer={
        snapshot.total > 0 ? (
          <p>
            <Link href="/ideas?status=PROMOTED" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              {snapshot.byStatus.PROMOTED === 0
                ? "None promoted to a project yet"
                : `${countPhrase(snapshot.byStatus.PROMOTED, "idea", "ideas")} promoted to a project`}
            </Link>
          </p>
        ) : (
          <p>
            <Link href="/ideas/new" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Capture a problem worth solving
            </Link>
          </p>
        )
      }
    />
  );
}

function InsightsPulse({ snapshot }: { snapshot: InsightsPulse }) {
  const mix: MixItem[] = [
    {
      key: "new_idea",
      count: snapshot.newIdeas,
      label: snapshot.newIdeas === 1 ? "new idea" : "new ideas",
      href: "/insights",
      bar: "bg-orange-600 dark:bg-orange-500",
    },
    {
      key: "improvement",
      count: snapshot.improvements,
      label: snapshot.improvements === 1 ? "improvement" : "improvements",
      href: "/insights",
      bar: "bg-zinc-400 dark:bg-zinc-500",
    },
  ];

  return (
    <PulseCard
      href="/insights"
      total={snapshot.total}
      caption={snapshot.total === 1 ? "saved insight" : "saved insights"}
      empty="No insights generated yet."
      mix={mix}
      footer={
        snapshot.total > 0 ? (
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              {snapshot.lastGeneratedAt
                ? `Last generated ${formatDate(snapshot.lastGeneratedAt)}`
                : "Not generated yet"}
            </li>
            <li>
              {snapshot.unsaved === 0
                ? "All saved as ideas"
                : `${countPhrase(snapshot.unsaved, "insight", "insights")} not saved as ideas`}
            </li>
          </ul>
        ) : (
          <p>
            <Link href="/insights" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Generate next moves across the directory
            </Link>
          </p>
        )
      }
    />
  );
}

export function WorkspacePulse({
  projects,
  ideas,
  insights,
}: {
  projects: PortfolioSnapshot;
  ideas: IdeasSnapshot;
  insights: InsightsPulse;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <ProjectsPulse snapshot={projects} />
      <IdeasPulse snapshot={ideas} />
      <InsightsPulse snapshot={insights} />
    </div>
  );
}
