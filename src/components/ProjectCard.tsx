import { Layers, Link2 } from "lucide-react";
import type { Project } from "@/types/project";
import { ContentCard, formatCardDate, toneFromId } from "@/components/ContentCard";
import { ProjectCardMenu } from "@/components/ProjectCardMenu";
import { ProjectTypeIcon } from "@/components/ProjectTypeIcon";
import { InternalDeployBadge } from "@/components/InternalDeployBadge";
import { stripMarkdown } from "@/lib/stripMarkdown";
import { hasInternalDeployment, INTERNAL_ACCESS_HINT, isInternalDeploymentUrl, primaryDeploymentUrl } from "@/lib/deploymentLabel";

const TYPE_LABEL: Record<Project["type"], string> = {
  PROJECT: "Project",
  POC: "POC",
  EXPERIMENT: "Experiment",
  TOOL: "Tool",
  OTHER: "Other",
};

export function ProjectCard({ project }: { project: Project }) {
  const techCount = project.technologies.length;
  const deployCount = project.deploymentUrls.length;
  const visitHref = primaryDeploymentUrl(project.deploymentUrls);

  return (
    <ContentCard
      href={`/projects/${project.id}`}
      tone={toneFromId(project.id)}
      badge={TYPE_LABEL[project.type]}
      extraBadge={hasInternalDeployment(project.deploymentUrls) ? <InternalDeployBadge /> : undefined}
      visual={<ProjectTypeIcon technologies={project.technologies} size={48} chrome="glyph" />}
      title={project.name}
      description={project.description ? stripMarkdown(project.description) : null}
      stats={[
        { icon: Layers, label: `${techCount} technolog${techCount === 1 ? "y" : "ies"}` },
        { icon: Link2, label: `${deployCount} deploy${deployCount === 1 ? "" : "s"}` },
      ]}
      footerLeft={`Updated: ${formatCardDate(project.updatedAt)}`}
      menu={<ProjectCardMenu id={project.id} name={project.name} githubUrl={project.githubUrl} />}
      visitHref={visitHref}
      visitHint={visitHref && isInternalDeploymentUrl(visitHref) ? `Internal server — ${INTERNAL_ACCESS_HINT}` : undefined}
    />
  );
}
