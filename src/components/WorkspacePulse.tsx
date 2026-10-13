import Link from "next/link";
import { FlaskConical, Folder, Lightbulb, Link2, Sparkles, type LucideIcon } from "lucide-react";
import { GithubIcon } from "@/components/icons/GithubIcon";
import { cn } from "@/lib/cn";
import type { PortfolioSnapshot } from "@/lib/portfolioSnapshot";
import type { IdeasSnapshot, InsightsPulse } from "@/lib/workspaceSnapshot";
import type { ProjectStatus } from "@/types/project";
import type { IdeaStatus } from "@/types/idea";
import { formatDate } from "@/lib/formatDate";

const PROJECT_STATUS_ORDER: ProjectStatus[] = ["ACTIVE", "COMPLETED", "ON_HOLD", "ARCHIVED"];

const PROJECT_STATUS_COPY: Record<ProjectStatus, { bar: string }> = {
  ACTIVE: { bar: "bg-orange-500" },
  COMPLETED: { bar: "bg-zinc-400 dark:bg-zinc-500" },
  ON_HOLD: { bar: "bg-zinc-300 dark:bg-zinc-600" },
  ARCHIVED: { bar: "bg-zinc-200 dark:bg-zinc-700" },
};

const IDEA_STATUS_ORDER: IdeaStatus[] = ["ACTIVE", "PROMOTED", "ON_HOLD", "ARCHIVED"];

const IDEA_STATUS_COPY: Record<IdeaStatus, { bar: string }> = {
  ACTIVE: { bar: "bg-orange-500" },
  PROMOTED: { bar: "bg-zinc-400 dark:bg-zinc-500" },
  ON_HOLD: { bar: "bg-zinc-300 dark:bg-zinc-600" },
  ARCHIVED: { bar: "bg-zinc-200 dark:bg-zinc-700" },
};

type IconType = LucideIcon | typeof GithubIcon;

function countPhrase(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

function KpiCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex h-full min-w-0 flex-col rounded-lg bg-white px-4 py-4 shadow-[0_1px_2px_rgba(24,24,27,0.04),0_10px_28px_rgba(24,24,27,0.05)] ring-1 ring-zinc-950/[0.04] sm:px-5 sm:py-5 dark:bg-zinc-900 dark:ring-white/10">
      {children}
    </section>
  );
}

function KpiIdentity({
  href,
  icon: Icon,
  iconClassName,
  total,
  caption,
  aside,
}: {
  href: string;
  icon: IconType;
  iconClassName: string;
  total: number;
  caption: string;
  aside?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
        <Link href={href} className="flex min-w-0 items-center gap-2.5">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", iconClassName)}>
            <Icon size={20} strokeWidth={1.75} />
          </span>
          <span className="text-3xl font-semibold leading-none tracking-tight text-zinc-950 tabular-nums dark:text-zinc-50">
            {total}
          </span>
        </Link>
        {aside}
      </div>
      <p className="mt-2 text-sm text-zinc-400">{caption}</p>
    </div>
  );
}

function StatusDot({
  href,
  count,
  label,
  dotClassName,
  roundedSide,
}: {
  href: string;
  count: number;
  label: string;
  dotClassName: string;
  roundedSide?: "left" | "right";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "my-0.5 flex min-w-0 flex-col items-center justify-center px-2 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10",
        roundedSide === "left" && "my-0.5 ml-0.5 rounded-l-md",
        roundedSide === "right" && "my-0.5 mr-0.5 rounded-r-md",
      )}
    >
      <span className="flex items-center gap-1.5">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClassName)} aria-hidden />
        <span className="text-sm font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{count}</span>
      </span>
      <span className="text-[11px] leading-tight text-zinc-400">{label}</span>
    </Link>
  );
}

function StatusPill({
  items,
}: {
  items: { href: string; count: number; label: string; dotClassName: string }[];
}) {
  return (
    <div className="flex shrink-0 items-stretch rounded-lg bg-orange-50 dark:bg-orange-500/10">
      {items.map((item, index) => (
        <span key={item.label} className="flex items-stretch">
          {index > 0 && <span className="my-2 w-px bg-orange-200/70 dark:bg-orange-500/30" aria-hidden />}
          <StatusDot
            {...item}
            roundedSide={index === 0 ? "left" : index === items.length - 1 ? "right" : undefined}
          />
        </span>
      ))}
    </div>
  );
}

function MixBar({ segments }: { segments: { key: string; count: number; bar: string }[] }) {
  const visible = segments.filter((item) => item.count > 0);
  if (visible.length === 0) return null;

  return (
    <div className="mt-4 flex h-2 overflow-hidden rounded-full" aria-hidden="true">
      {visible.map((item) => (
        <span key={item.key} className={cn("h-full", item.bar)} style={{ flexGrow: item.count, flexBasis: 0 }} />
      ))}
    </div>
  );
}

function ProjectsPulse({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const { total, byStatus, github, reachable, internal, poc } = snapshot;
  const inMotion = byStatus.ACTIVE;
  const completed = byStatus.COMPLETED;
  const segments = PROJECT_STATUS_ORDER.map((status) => ({
    key: status,
    count: byStatus[status],
    bar: PROJECT_STATUS_COPY[status].bar,
  }));

  const githubValue = github === 0 ? "None" : github === total ? "All connected" : `${github} connected`;
  const liveValue = reachable === 0 ? "None" : internal > 0 ? `${reachable} · ${internal} internal` : `${reachable}`;
  const pocValue = poc === 0 ? "None" : `${poc}`;

  return (
    <KpiCard>
      <KpiIdentity
        href="/projects"
        icon={Folder}
        iconClassName="bg-orange-50 text-orange-500 dark:bg-orange-500/15 dark:text-orange-300"
        total={total}
        caption="Projects in directory"
        aside={
          total > 0 ? (
            <StatusPill
              items={[
                { href: "/projects?status=ACTIVE", count: inMotion, label: "In motion", dotClassName: "bg-orange-500" },
                { href: "/projects?status=COMPLETED", count: completed, label: "Completed", dotClassName: "bg-zinc-400 dark:bg-zinc-500" },
              ]}
            />
          ) : null
        }
      />

      {total === 0 ? (
        <p className="mt-4 text-sm text-zinc-400">No projects yet.</p>
      ) : (
        <>
          <MixBar segments={segments} />
          <div className="mt-auto grid min-h-16 grid-cols-3 items-center divide-x divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
            <ProjectStat
              href={github > 0 ? "/projects?github=1" : undefined}
              icon={GithubIcon}
              iconClassName="rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              label="GitHub"
              value={githubValue}
            />
            <ProjectStat
              href="/projects"
              icon={Link2}
              iconClassName="rounded-lg bg-sky-50 text-sky-500 dark:bg-sky-500/15 dark:text-sky-300"
              label="Live URLs"
              value={liveValue}
            />
            <ProjectStat
              href={poc > 0 ? "/projects?type=POC" : undefined}
              icon={FlaskConical}
              iconClassName="rounded-lg bg-violet-50 text-violet-500 dark:bg-violet-500/15 dark:text-violet-300"
              label="POCs"
              value={pocValue}
            />
          </div>
        </>
      )}
    </KpiCard>
  );
}

function ProjectStat({
  href,
  icon: Icon,
  iconClassName,
  label,
  value,
}: {
  href?: string;
  icon: IconType;
  iconClassName: string;
  label: string;
  value: string;
}) {
  const body = (
    <>
      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center", iconClassName)}>
        <Icon size={13} strokeWidth={1.75} />
      </span>
      <span className="min-w-0">
        <span className="block whitespace-nowrap text-[11px] leading-none text-zinc-400">{label}</span>
        <span className="mt-0.5 block whitespace-nowrap text-[11px] font-semibold leading-none text-zinc-950 dark:text-zinc-50">
          {value}
        </span>
      </span>
    </>
  );

  const className = "flex min-w-0 items-center justify-center gap-1.5 px-1";

  if (!href) return <div className={className}>{body}</div>;

  return (
    <Link href={href} className={cn(className, "transition-opacity hover:opacity-80")}>
      {body}
    </Link>
  );
}

function IdeasPulse({ snapshot }: { snapshot: IdeasSnapshot }) {
  const segments = IDEA_STATUS_ORDER.map((status) => ({
    key: status,
    count: snapshot.byStatus[status],
    bar: IDEA_STATUS_COPY[status].bar,
  }));
  const active = snapshot.byStatus.ACTIVE;
  const promoted = snapshot.byStatus.PROMOTED;

  return (
    <KpiCard>
      <KpiIdentity
        href="/ideas"
        icon={Lightbulb}
        iconClassName="bg-amber-50 text-amber-500 dark:bg-amber-500/15 dark:text-amber-300"
        total={snapshot.total}
        caption={snapshot.total === 1 ? "Idea in the pipeline" : "Ideas in the pipeline"}
        aside={
          snapshot.total > 0 ? (
            <StatusPill
              items={[
                { href: "/ideas?status=ACTIVE", count: active, label: "Active", dotClassName: "bg-orange-500" },
                { href: "/ideas?status=PROMOTED", count: promoted, label: "Promoted", dotClassName: "bg-zinc-400 dark:bg-zinc-500" },
              ]}
            />
          ) : null
        }
      />

      {snapshot.total === 0 ? (
        <p className="mt-4 text-sm text-zinc-400">
          <Link href="/ideas/new" className="hover:text-zinc-700 dark:hover:text-zinc-200">
            No ideas yet.
          </Link>
        </p>
      ) : (
        <>
          <MixBar segments={segments} />
          <p className="mt-auto flex min-h-16 items-center border-t border-zinc-100 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
            <Link href="/ideas?status=PROMOTED" className="hover:text-zinc-950 dark:hover:text-zinc-50">
              {promoted === 0
                ? "None promoted to a project yet"
                : `${countPhrase(promoted, "idea", "ideas")} promoted to a project`}
            </Link>
          </p>
        </>
      )}
    </KpiCard>
  );
}

function InsightsPulseCard({ snapshot }: { snapshot: InsightsPulse }) {
  const segments = [
    { key: "new_idea", count: snapshot.newIdeas, bar: "bg-orange-500" },
    { key: "improvement", count: snapshot.improvements, bar: "bg-zinc-400 dark:bg-zinc-500" },
  ];

  return (
    <KpiCard>
      <KpiIdentity
        href="/insights"
        icon={Sparkles}
        iconClassName="bg-violet-50 text-violet-500 dark:bg-violet-500/15 dark:text-violet-300"
        total={snapshot.total}
        caption={snapshot.total === 1 ? "Saved insight" : "Saved insights"}
        aside={
          snapshot.total > 0 ? (
            <StatusPill
              items={[
                { href: "/insights", count: snapshot.newIdeas, label: "New ideas", dotClassName: "bg-orange-500" },
                { href: "/insights", count: snapshot.improvements, label: "Improvements", dotClassName: "bg-zinc-400 dark:bg-zinc-500" },
              ]}
            />
          ) : null
        }
      />

      {snapshot.total === 0 ? (
        <p className="mt-4 text-sm text-zinc-400">
          <Link href="/insights" className="hover:text-zinc-700 dark:hover:text-zinc-200">
            No insights generated yet.
          </Link>
        </p>
      ) : (
        <>
          <MixBar segments={segments} />
          <p className="mt-auto flex min-h-16 items-center border-t border-zinc-100 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
            {snapshot.lastGeneratedAt ? `Last generated ${formatDate(snapshot.lastGeneratedAt)}` : "Not generated yet"}
            <span className="text-zinc-300 dark:text-zinc-600"> · </span>
            {snapshot.unsaved === 0
              ? "All saved as ideas"
              : `${countPhrase(snapshot.unsaved, "insight", "insights")} not saved as ideas`}
          </p>
        </>
      )}
    </KpiCard>
  );
}

const PULSE_COLUMNS = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3" } as const;

/** A null snapshot means the signed-in user has no access to that area, so its card is left out. */
export function WorkspacePulse({
  projects,
  ideas,
  insights,
}: {
  projects: PortfolioSnapshot | null;
  ideas: IdeasSnapshot | null;
  insights: InsightsPulse | null;
}) {
  const count = [projects, ideas, insights].filter(Boolean).length;
  if (count === 0) return null;
  const visible = count as 1 | 2 | 3;
  return (
    <div className={`grid grid-cols-1 items-stretch gap-4 ${PULSE_COLUMNS[visible]}`}>
      {projects && <ProjectsPulse snapshot={projects} />}
      {ideas && <IdeasPulse snapshot={ideas} />}
      {insights && <InsightsPulseCard snapshot={insights} />}
    </div>
  );
}
