import type { Project, ProjectStatus } from "@/types/project";
import { hasInternalDeployment } from "@/lib/deploymentLabel";

export interface PortfolioSnapshot {
  total: number;
  byStatus: Record<ProjectStatus, number>;
  github: number;
  reachable: number;
  internal: number;
  poc: number;
}

const EMPTY_STATUS: Record<ProjectStatus, number> = {
  ACTIVE: 0,
  COMPLETED: 0,
  ON_HOLD: 0,
  ARCHIVED: 0,
};

/** Pure catalog readout — derived from the same project list the dashboard already has. */
export function portfolioSnapshot(projects: Project[]): PortfolioSnapshot {
  const byStatus = { ...EMPTY_STATUS };
  let github = 0;
  let reachable = 0;
  let internal = 0;
  let poc = 0;

  for (const project of projects) {
    byStatus[project.status] += 1;
    if (project.githubUrl) github += 1;
    if (project.deploymentUrls.length > 0) reachable += 1;
    if (hasInternalDeployment(project.deploymentUrls)) internal += 1;
    if (project.type === "POC") poc += 1;
  }

  return { total: projects.length, byStatus, github, reachable, internal, poc };
}
