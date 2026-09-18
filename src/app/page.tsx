import { Suspense } from "react";
import { Plus } from "lucide-react";
import { ProjectExplorer } from "@/components/ProjectExplorer";
import { CatalogPulse } from "@/components/CatalogPulse";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { listProjects } from "@/lib/projects";
import { portfolioSnapshot } from "@/lib/portfolioSnapshot";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const projects = await listProjects();
  const snapshot = portfolioSnapshot(projects);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Project Portfolio</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">The AIML work currently in this directory.</p>
        </div>
        <Button href="/projects/new" variant="primary" icon={Plus}>
          New Project
        </Button>
      </div>

      <CatalogPulse snapshot={snapshot} />

      <Suspense fallback={<SkeletonCardGrid />}>
        <ProjectExplorer initialProjects={projects} />
      </Suspense>
    </div>
  );
}
