import { loadViewAccess, requireUser } from "@/lib/auth/dal";
import { can, scopeFor } from "@/lib/auth/permissions";
import { Suspense } from "react";
import { Lightbulb, Plus } from "lucide-react";
import { ProjectExplorer } from "@/components/ProjectExplorer";
import { WorkspacePulse } from "@/components/WorkspacePulse";
import { DashboardFeed } from "@/components/DashboardFeed";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { loadAccessScope } from "@/lib/auth/scopeLoader";
import { getProjectTableColumns } from "@/lib/projectTableSettings";
import { listProjects } from "@/lib/projects";
import { listIdeas } from "@/lib/ideas";
import { CATALOG_INSIGHT_SCOPE, getInsightSnapshot } from "@/lib/insightCatalog";
import { portfolioSnapshot } from "@/lib/portfolioSnapshot";
import { ideasSnapshot, insightsPulse, takeRecent } from "@/lib/workspaceSnapshot";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const view = await loadViewAccess(user);

  // Each area appears only when the user may view it; insights also need full access because
  // they summarise the whole directory.
  const showProjects = can(user.permissions, "projects", "view");
  const showIdeas = can(user.permissions, "ideas", "view");
  const showInsights = scopeFor(user.permissions, "insights", "view") === "ALL";

  const [projects, ideas, insightSnap] = await Promise.all([
    showProjects ? listProjects({}, view.projects) : Promise.resolve([]),
    showIdeas ? listIdeas({}, view.ideas) : Promise.resolve([]),
    showInsights ? getInsightSnapshot(CATALOG_INSIGHT_SCOPE) : Promise.resolve(null),
  ]);

  const [tableColumns, myScope] = await Promise.all([
    getProjectTableColumns(),
    loadAccessScope(user, "OWN", "view"),
  ]);
  // Names that count as "mine": the user's own name plus any owner names an admin linked to them.
  const myOwnerNames = myScope.all ? [] : myScope.ownerNames;
  const canSetDefaultColumns = can(user.permissions, "settings", "edit");
  const canCreateIdea = can(user.permissions, "ideas", "create");
  const canCreateProject = can(user.permissions, "projects", "create");
  const scopedToOwn = scopeFor(user.permissions, "projects", "view") === "OWN";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {scopedToOwn
              ? "Projects, ideas, and insights you own or that were shared with you."
              : "Projects, ideas, and insights currently in this directory."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreateIdea && (
            <Button href="/ideas/new" variant="secondary" icon={Lightbulb}>
              New Idea
            </Button>
          )}
          {canCreateProject && (
            <Button href="/projects/new" variant="primary" icon={Plus}>
              New Project
            </Button>
          )}
        </div>
      </div>

      <WorkspacePulse
        projects={showProjects ? portfolioSnapshot(projects) : null}
        ideas={showIdeas ? ideasSnapshot(ideas) : null}
        insights={insightSnap ? insightsPulse(insightSnap) : null}
      />

      <DashboardFeed
        ideas={showIdeas ? takeRecent(ideas, (idea) => idea.updatedAt) : null}
        insights={insightSnap ? takeRecent(insightSnap.insights, (insight) => insight.lastGeneratedAt) : null}
      />

      {showProjects && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Projects</h2>
          <Suspense fallback={<SkeletonCardGrid />}>
            <ProjectExplorer
              initialProjects={projects}
              columns={tableColumns}
              canSetDefaultColumns={canSetDefaultColumns}
              myOwnerNames={myOwnerNames}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
