import Link from "next/link";
import { Clock } from "lucide-react";
import type { Project } from "@/types/project";
import { ProjectStatusBadge } from "@/components/ProjectStatusBadge";
import { ProjectTypeBadge } from "@/components/ProjectTypeBadge";
import { ProjectCardMenu } from "@/components/ProjectCardMenu";
import { ProjectTypeIcon } from "@/components/ProjectTypeIcon";
import { InternalDeployBadge } from "@/components/InternalDeployBadge";
import { GithubIcon } from "@/components/icons/GithubIcon";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { stripMarkdown } from "@/lib/stripMarkdown";
import { hasInternalDeployment } from "@/lib/deploymentLabel";

export function ProjectListRow({ project }: { project: Project }) {
  return (
    <div className="flex items-center gap-4 bg-white px-5 py-4 transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/60">
      <ProjectTypeIcon technologies={project.technologies} size={44} />

      <div className="min-w-0 flex-1">
        <Link
          href={`/projects/${project.id}`}
          className="block truncate text-base font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
        >
          {project.name}
        </Link>
        {project.description && (
          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{stripMarkdown(project.description)}</p>
        )}
      </div>

      <div className="hidden w-52 shrink-0 flex-wrap items-center gap-1.5 sm:flex">
        <ProjectTypeBadge type={project.type} />
        <ProjectStatusBadge status={project.status} />
        {hasInternalDeployment(project.deploymentUrls) && <InternalDeployBadge />}
      </div>

      <div className="hidden w-40 shrink-0 flex-col items-start gap-1 text-sm text-zinc-500 dark:text-zinc-400 md:flex">
        {project.githubUrl && (
          <a
            href={project.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <GithubIcon size={14} />
            GitHub
          </a>
        )}
        {project.githubUrl && (
          <span className="flex items-center gap-1.5 text-xs">
            <Clock size={12} />
            {project.lastSyncedAt ? `Synced ${formatRelativeTime(project.lastSyncedAt)}` : "Never synced"}
          </span>
        )}
      </div>

      <ProjectCardMenu id={project.id} name={project.name} githubUrl={project.githubUrl} />
    </div>
  );
}
