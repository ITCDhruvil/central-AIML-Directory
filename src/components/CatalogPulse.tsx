import Link from "next/link";
import { cn } from "@/lib/cn";
import type { PortfolioSnapshot } from "@/lib/portfolioSnapshot";
import type { ProjectStatus } from "@/types/project";

const STATUS_ORDER: ProjectStatus[] = ["ACTIVE", "COMPLETED", "ON_HOLD", "ARCHIVED"];

const STATUS_COPY: Record<ProjectStatus, { label: string; href: string; bar: string }> = {
  ACTIVE: { label: "in motion", href: "/projects?status=ACTIVE", bar: "bg-orange-600 dark:bg-orange-500" },
  COMPLETED: { label: "completed", href: "/projects?status=COMPLETED", bar: "bg-zinc-400 dark:bg-zinc-500" },
  ON_HOLD: { label: "on hold", href: "/projects?status=ON_HOLD", bar: "bg-zinc-300 dark:bg-zinc-600" },
  ARCHIVED: { label: "archived", href: "/projects?status=ARCHIVED", bar: "bg-zinc-200 dark:bg-zinc-700" },
};

function countPhrase(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function CatalogPulse({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const { total, byStatus, github, reachable, internal, poc } = snapshot;
  const mix = STATUS_ORDER.map((status) => ({ status, count: byStatus[status] })).filter((s) => s.count > 0);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-5xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">{total}</p>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            {total === 1 ? "project in the directory" : "projects in the directory"}
          </p>
        </div>

        <div className="min-w-0 sm:max-w-md sm:flex-1">
          {total === 0 ? (
            <p className="text-sm text-zinc-400">Nothing to mix yet.</p>
          ) : (
            <>
              <div
                className="flex h-2 overflow-hidden rounded-sm bg-zinc-100 dark:bg-zinc-800"
                aria-hidden="true"
              >
                {mix.map(({ status, count }) => (
                  <span
                    key={status}
                    className={cn("h-full min-w-1", STATUS_COPY[status].bar)}
                    style={{ flexGrow: count }}
                  />
                ))}
              </div>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {mix.map(({ status, count }, i) => (
                  <span key={status}>
                    {i > 0 ? ", " : ""}
                    <Link href={STATUS_COPY[status].href} className="hover:text-zinc-800 dark:hover:text-zinc-200">
                      {count} {STATUS_COPY[status].label}
                    </Link>
                  </span>
                ))}
              </p>
            </>
          )}
        </div>
      </div>

      {total > 0 && (
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-100 pt-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          <li>
            {github === total ? (
              <Link href="/projects?github=1" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                All on GitHub
              </Link>
            ) : (
              <Link href="/projects?github=1" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                {github} of {total} on GitHub
              </Link>
            )}
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
      )}
    </section>
  );
}
