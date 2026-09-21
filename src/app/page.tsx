import { Suspense } from "react";
import { Lightbulb, Plus } from "lucide-react";
import { ProjectExplorer } from "@/components/ProjectExplorer";
import { WorkspacePulse } from "@/components/WorkspacePulse";
import { DashboardFeed } from "@/components/DashboardFeed";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { listProjects } from "@/lib/projects";
import { listIdeas } from "@/lib/ideas";
import { CATALOG_INSIGHT_SCOPE, getInsightSnapshot } from "@/lib/insightCatalog";
import { portfolioSnapshot } from "@/lib/portfolioSnapshot";
import { ideasSnapshot, insightsPulse, takeRecent } from "@/lib/workspaceSnapshot";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [projects, ideas, insightSnap] = await Promise.all([
    listProjects(),
    listIdeas(),
    getInsightSnapshot(CATALOG_INSIGHT_SCOPE),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Projects, ideas, and insights currently in this directory.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button href="/ideas/new" variant="secondary" icon={Lightbulb}>
            New Idea
          </Button>
          <Button href="/projects/new" variant="primary" icon={Plus}>
            New Project
          </Button>
        </div>
      </div>

      <WorkspacePulse
        projects={portfolioSnapshot(projects)}
        ideas={ideasSnapshot(ideas)}
        insights={insightsPulse(insightSnap)}
      />

      <DashboardFeed
        ideas={takeRecent(ideas, (idea) => idea.updatedAt)}
        insights={takeRecent(insightSnap.insights, (insight) => insight.lastGeneratedAt)}
      />

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Projects</h2>
        <Suspense fallback={<SkeletonCardGrid />}>
          <ProjectExplorer initialProjects={projects} />
        </Suspense>
      </div>
    </div>
  );
}
