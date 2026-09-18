import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { deploymentUrlsChanged, recordProjectActivity } from "@/lib/projectActivity";
import { ensureOwnerName } from "@/lib/owners";
import { toProject } from "@/lib/projectMapper";
import { uniqueSlug } from "@/lib/slug";
import { validateProjectInput, type ValidatedDocument } from "@/lib/validation";
import { PROJECT_STATUSES, PROJECT_TYPES, type Project } from "@/types/project";

export interface ProjectFilters {
  q?: string;
  type?: string;
  status?: string;
}

export class ProjectNotFoundError extends Error {}

export function buildProjectWhere(filters: ProjectFilters) {
  const where: Record<string, unknown> = {};

  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q } },
      { description: { contains: filters.q } },
    ];
  }
  if (filters.type && PROJECT_TYPES.includes(filters.type as (typeof PROJECT_TYPES)[number])) {
    where.type = filters.type;
  }
  if (filters.status && PROJECT_STATUSES.includes(filters.status as (typeof PROJECT_STATUSES)[number])) {
    where.status = filters.status;
  }

  return where;
}

export async function listProjects(filters: ProjectFilters = {}): Promise<Project[]> {
  const rows = await prisma.project.findMany({
    where: buildProjectWhere(filters),
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toProject);
}

export async function getProjectById(id: string): Promise<Project | null> {
  const row = await prisma.project.findUnique({ where: { id } });
  return row ? toProject(row) : null;
}

/** Creates and persists a new project. `rawInput` is validated here — callers (the POST route, chatbot tools) may pass unvalidated body/tool-call data straight through. */
/** type/status are required by validateProjectInput but every caller shouldn't have to know that — default them here the same way `stage` already defaults to IDEA below, so a bare {name: "..."} is enough to create a project. */
function withCreateDefaults(rawInput: unknown): unknown {
  if (typeof rawInput !== "object" || rawInput === null) return rawInput;
  const data = { ...(rawInput as Record<string, unknown>) };
  if (!data.type) data.type = "PROJECT";
  if (!data.status) data.status = "ACTIVE";
  return data;
}

export async function createProject(rawInput: unknown, documents: ValidatedDocument[] = []): Promise<Project> {
  const input = validateProjectInput(withCreateDefaults(rawInput));
  const slug = await uniqueSlug(input.name);
  // New projects default to IDEA when stage is unset; existing rows stay null until edited.
  const stage = input.stage ?? "IDEA";

  const row = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        type: input.type,
        status: input.status,
        stage,
        owner: input.owner ?? null,
        githubUrl: input.githubUrl ?? null,
        githubOwner: input.githubOwner ?? null,
        githubRepo: input.githubRepo ?? null,
        defaultBranch: input.defaultBranch ?? null,
        technologies: JSON.stringify(input.technologies ?? []),
        tags: JSON.stringify(input.tags ?? []),
        deploymentUrls: JSON.stringify(input.deploymentUrls ?? []),
      },
    });

    for (const doc of documents) {
      await tx.documentation.upsert({
        where: { projectId_filePath: { projectId: project.id, filePath: doc.filePath } },
        create: {
          projectId: project.id,
          title: doc.title,
          category: doc.category,
          filePath: doc.filePath,
          content: doc.content,
          source: doc.source ?? "github",
          generatedFromContentHash: doc.generatedFromContentHash,
        },
        update: {
          title: doc.title,
          category: doc.category,
          content: doc.content,
          source: doc.source ?? "github",
          generatedFromContentHash: doc.generatedFromContentHash,
        },
      });
    }

    await recordProjectActivity(tx, project.id, "PROJECT_CREATED", `Created project “${project.name}”`);

    return project;
  });

  await ensureOwnerName(input.owner);
  return toProject(row);
}

/**
 * Partially updates a project: any field omitted from `patch` keeps its current
 * value. Internally merges onto the existing project and re-validates the
 * whole thing (same rules as a full PUT), so a partial `{ status: "ARCHIVED" }`
 * patch is exactly as safe as editing the full form. Shared by the PUT route
 * and the chatbot's update_project tool so the two never diverge.
 */
export async function updateProjectFields(id: string, patch: unknown): Promise<Project> {
  const existingRow = await prisma.project.findUnique({ where: { id } });
  if (!existingRow) {
    throw new ProjectNotFoundError(`Project ${id} not found`);
  }
  const existing = toProject(existingRow);
  const patchObj = typeof patch === "object" && patch !== null ? (patch as Record<string, unknown>) : {};

  const merged = {
    name: patchObj.name !== undefined ? patchObj.name : existing.name,
    description: patchObj.description !== undefined ? patchObj.description : existing.description,
    type: patchObj.type !== undefined ? patchObj.type : existing.type,
    status: patchObj.status !== undefined ? patchObj.status : existing.status,
    stage: patchObj.stage !== undefined ? patchObj.stage : existing.stage,
    owner: patchObj.owner !== undefined ? patchObj.owner : existing.owner,
    githubUrl: patchObj.githubUrl !== undefined ? patchObj.githubUrl : existing.githubUrl,
    githubOwner: patchObj.githubOwner !== undefined ? patchObj.githubOwner : existing.githubOwner,
    githubRepo: patchObj.githubRepo !== undefined ? patchObj.githubRepo : existing.githubRepo,
    defaultBranch: patchObj.defaultBranch !== undefined ? patchObj.defaultBranch : existing.defaultBranch,
    technologies: patchObj.technologies !== undefined ? patchObj.technologies : existing.technologies,
    tags: patchObj.tags !== undefined ? patchObj.tags : existing.tags,
    deploymentUrls: patchObj.deploymentUrls !== undefined ? patchObj.deploymentUrls : existing.deploymentUrls,
  };

  const input = validateProjectInput(merged);
  const slug = input.name === existingRow.name ? existingRow.slug : await uniqueSlug(input.name, id);
  const nextDeploymentUrls = input.deploymentUrls ?? [];
  const deploymentsChanged = deploymentUrlsChanged(existing.deploymentUrls, nextDeploymentUrls);

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id },
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        type: input.type,
        status: input.status,
        stage: input.stage ?? null,
        owner: input.owner ?? null,
        githubUrl: input.githubUrl ?? null,
        githubOwner: input.githubOwner ?? null,
        githubRepo: input.githubRepo ?? null,
        defaultBranch: input.defaultBranch ?? null,
        technologies: JSON.stringify(input.technologies ?? []),
        tags: JSON.stringify(input.tags ?? []),
        deploymentUrls: JSON.stringify(nextDeploymentUrls),
      },
    });

    // One activity per successful update — prefer DEPLOYMENT_UPDATED when URLs changed.
    if (deploymentsChanged) {
      await recordProjectActivity(tx, id, "DEPLOYMENT_UPDATED", "Deployment URLs updated");
    } else {
      await recordProjectActivity(tx, id, "PROJECT_UPDATED", `Updated project “${updated.name}”`);
    }

    return updated;
  });

  await ensureOwnerName(input.owner);
  return toProject(row);
}

export async function deleteProjectById(id: string): Promise<void> {
  try {
    await prisma.project.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new ProjectNotFoundError(`Project ${id} not found`);
    }
    throw error;
  }
}

export async function getProjectStats() {
  const [total, active, poc, githubConnected] = await Promise.all([
    prisma.project.count(),
    prisma.project.count({ where: { status: "ACTIVE" } }),
    prisma.project.count({ where: { type: "POC" } }),
    prisma.project.count({ where: { githubUrl: { not: null } } }),
  ]);
  return { total, active, poc, githubConnected };
}
