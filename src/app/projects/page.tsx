import { Suspense } from "react";
import { ProjectExplorer } from "@/components/ProjectExplorer";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { requirePagePermission } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { loadAccessScope } from "@/lib/auth/scopeLoader";
import { listProjects } from "@/lib/projects";
import { getProjectTableColumns } from "@/lib/projectTableSettings";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * The Projects page uses the same table, search and filter menu as the dashboard. Links such as
 * /projects?status=ACTIVE, ?type=POC and ?github=1 (from the dashboard cards) arrive as starting filters.
 */
export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, access } = await requirePagePermission("projects", "view");
  const params = await searchParams;

  const [projects, columns, mine] = await Promise.all([
    listProjects({}, access),
    getProjectTableColumns(),
    loadAccessScope(user, "OWN", "view"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Projects</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Explore and manage your AI/ML projects, ideas and documentation.
        </p>
      </div>

      <Suspense fallback={<SkeletonCardGrid />}>
        <ProjectExplorer
          variant="page"
          initialProjects={projects}
          columns={columns}
          canSetDefaultColumns={can(user.permissions, "settings", "edit")}
          myOwnerNames={mine.all ? [] : mine.ownerNames}
          initialFilters={{
            type: first(params.type),
            status: first(params.status),
            github: first(params.github) === "1",
          }}
        />
      </Suspense>
    </div>
  );
}
