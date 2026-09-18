import { getProjectById, listProjects } from "@/lib/projects";
import { listIdeas } from "@/lib/ideas";
import { stripMarkdown } from "@/lib/stripMarkdown";

const DESCRIPTION_CHAR_BUDGET = 500;

export interface InsightsContextItem {
  name: string;
  status: string;
  description: string;
  tags: string[];
  technologies: string[];
}

export interface InsightsContext {
  projects: InsightsContextItem[];
  ideas: InsightsContextItem[];
  /** Set when scoped to one project (the "Suggest improvements" button on a project page) — narrows what the model is asked to produce. */
  scopedProjectName: string | null;
}

function compactDescription(description: string | null): string {
  if (!description) return "(no description)";
  const plain = stripMarkdown(description).trim();
  return plain.length > DESCRIPTION_CHAR_BUDGET ? `${plain.slice(0, DESCRIPTION_CHAR_BUDGET)}...` : plain;
}

export class InsightsContextNotFoundError extends Error {}

/**
 * Gathers everything the insights AI reasons over: every project and idea's
 * name/status/tags/tech/description, compacted to keep the prompt a
 * reasonable size even with a large library. When `projectId` is given
 * (the per-project "Suggest improvements" button), narrows to just that one
 * project so every suggestion comes back scoped to it.
 */
export async function buildInsightsContext(projectId?: string): Promise<InsightsContext> {
  if (projectId) {
    const project = await getProjectById(projectId);
    if (!project) {
      throw new InsightsContextNotFoundError(`Project ${projectId} not found`);
    }
    return {
      projects: [
        {
          name: project.name,
          status: project.status,
          description: compactDescription(project.description),
          tags: project.tags,
          technologies: project.technologies.map((t) => t.name),
        },
      ],
      ideas: [],
      scopedProjectName: project.name,
    };
  }

  const [projects, ideas] = await Promise.all([listProjects(), listIdeas()]);

  return {
    projects: projects.map((p) => ({
      name: p.name,
      status: p.status,
      description: compactDescription(p.description),
      tags: p.tags,
      technologies: p.technologies.map((t) => t.name),
    })),
    ideas: ideas.map((i) => ({
      name: i.name,
      status: i.status,
      description: compactDescription(i.description),
      tags: i.tags,
      technologies: i.technologies.map((t) => t.name),
    })),
    scopedProjectName: null,
  };
}
