import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { deploymentUrlsChanged, recordProjectActivity } from "@/lib/projectActivity";
import { ensureOwnerName } from "@/lib/owners";
import { toProject } from "@/lib/projectMapper";
import { removeTeam, withTeams } from "@/lib/projectTeam";
import { ownerPrismaClause } from "@/lib/ownerSearch";
import { ALL_ACCESS, andWhere, projectScopeWhere, type AccessScope } from "@/lib/auth/scope";
import {
  DOCUMENT_SEARCH_FIELDS,
  PROJECT_ACTIVITY_SEARCH_FIELDS,
  PROJECT_SEARCH_FIELDS,
  containsInsensitive,
  orContainsFields,
} from "@/lib/schemaSearch";
import { uniqueSlug } from "@/lib/slug";
import { validateProjectInput, type ValidatedDocument } from "@/lib/validation";
import { PROJECT_STAGES, PROJECT_STATUSES, PROJECT_TYPES, type Project } from "@/types/project";

export interface ProjectFilters {
  q?: string;
  type?: string;
  status?: string;
  stage?: string;
  owner?: string;
  tag?: string;
  technology?: string;
}

export class ProjectNotFoundError extends Error {}

export function buildProjectWhere(filters: ProjectFilters) {
  const clauses: Record<string, unknown>[] = [];

  if (filters.q) {
    const q = filters.q.trim();
    if (q) {
      const ownerMatch = ownerPrismaClause(q);
      clauses.push({
        OR: [
          ...orContainsFields(PROJECT_SEARCH_FIELDS, q),
          ...(ownerMatch ? [ownerMatch] : []),
          { documentation: { some: { OR: orContainsFields(DOCUMENT_SEARCH_FIELDS, q) } } },
          { activities: { some: { OR: orContainsFields(PROJECT_ACTIVITY_SEARCH_FIELDS, q) } } },
        ],
      });
    }
  }
  if (filters.owner) {
    const ownerMatch = ownerPrismaClause(filters.owner);
    if (ownerMatch) clauses.push(ownerMatch);
  }
  if (filters.type && PROJECT_TYPES.includes(filters.type as (typeof PROJECT_TYPES)[number])) {
    clauses.push({ type: filters.type });
  }
  if (filters.status && PROJECT_STATUSES.includes(filters.status as (typeof PROJECT_STATUSES)[number])) {
    clauses.push({ status: filters.status });
  }
  if (filters.stage && PROJECT_STAGES.includes(filters.stage as (typeof PROJECT_STAGES)[number])) {
    clauses.push({ stage: filters.stage });
  }
  if (filters.tag?.trim()) {
    clauses.push({ tags: containsInsensitive(filters.tag.trim()) });
  }
  if (filters.technology?.trim()) {
    clauses.push({ technologies: containsInsensitive(filters.technology.trim()) });
  }

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { AND: clauses };
}

/** `access` limits results to what a scoped (non-admin) user may see; defaults to everything. */
export async function listProjects(filters: ProjectFilters = {}, access: AccessScope = ALL_ACCESS): Promise<Project[]> {
  const rows = await prisma.project.findMany({
    where: andWhere(buildProjectWhere(filters), projectScopeWhere(access)),
    orderBy: { createdAt: "desc" },
  });
  return withTeams(rows.map(toProject));
}

export async function getProjectById(id: string, access: AccessScope = ALL_ACCESS): Promise<Project | null> {
  const row = await prisma.project.findFirst({ where: andWhere({ id }, projectScopeWhere(access)) });
  return row ? (await withTeams([toProject(row)]))[0] : null;
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
export async function updateProjectFields(
  id: string,
  patch: unknown,
  access: AccessScope = ALL_ACCESS,
): Promise<Project> {
  const existingRow = await prisma.project.findFirst({ where: andWhere({ id }, projectScopeWhere(access)) });
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

export async function deleteProjectById(id: string, access: AccessScope = ALL_ACCESS): Promise<void> {
  const visible = await prisma.project.findFirst({ where: andWhere({ id }, projectScopeWhere(access)), select: { id: true } });
  if (!visible) throw new ProjectNotFoundError(`Project ${id} not found`);
  try {
    await prisma.project.delete({ where: { id } });
    await removeTeam("PROJECT", id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new ProjectNotFoundError(`Project ${id} not found`);
    }
    throw error;
  }
}

export async function getProjectStats(access: AccessScope = ALL_ACCESS) {
  const scope = projectScopeWhere(access);
  const [total, active, poc, githubConnected] = await Promise.all([
    prisma.project.count({ where: scope }),
    prisma.project.count({ where: andWhere({ status: "ACTIVE" }, scope) }),
    prisma.project.count({ where: andWhere({ type: "POC" }, scope) }),
    prisma.project.count({ where: andWhere({ githubUrl: { not: null } }, scope) }),
  ]);
  return { total, active, poc, githubConnected };
}
