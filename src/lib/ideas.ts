import { prisma } from "@/lib/prisma";
import { ensureOwnerName } from "@/lib/owners";
import { removeTeam } from "@/lib/projectTeam";
import { toIdea } from "@/lib/ideaMapper";
import { createProject } from "@/lib/projects";
import { ownerPrismaClause } from "@/lib/ownerSearch";
import { ALL_ACCESS, andWhere, ideaScopeWhere, type AccessScope } from "@/lib/auth/scope";
import { IDEA_SEARCH_FIELDS, containsInsensitive, orContainsFields } from "@/lib/schemaSearch";
import { uniqueIdeaSlug } from "@/lib/slug";
import { validateIdeaInput, ValidationError } from "@/lib/validation";
import { IDEA_STATUSES, type Idea } from "@/types/idea";

export interface IdeaFilters {
  q?: string;
  status?: string;
  owner?: string;
  tag?: string;
  technology?: string;
}

export class IdeaNotFoundError extends Error {}

export function buildIdeaWhere(filters: IdeaFilters) {
  const clauses: Record<string, unknown>[] = [];

  if (filters.q) {
    const q = filters.q.trim();
    if (q) {
      const ownerMatch = ownerPrismaClause(q);
      clauses.push({
        OR: [...orContainsFields(IDEA_SEARCH_FIELDS, q), ...(ownerMatch ? [ownerMatch] : [])],
      });
    }
  }
  if (filters.owner) {
    const ownerMatch = ownerPrismaClause(filters.owner);
    if (ownerMatch) clauses.push(ownerMatch);
  }
  if (filters.status && IDEA_STATUSES.includes(filters.status as (typeof IDEA_STATUSES)[number])) {
    clauses.push({ status: filters.status });
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
export async function listIdeas(filters: IdeaFilters = {}, access: AccessScope = ALL_ACCESS): Promise<Idea[]> {
  const rows = await prisma.idea.findMany({
    where: andWhere(buildIdeaWhere(filters), ideaScopeWhere(access)),
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toIdea);
}

export async function getIdeaById(id: string, access: AccessScope = ALL_ACCESS): Promise<Idea | null> {
  const row = await prisma.idea.findFirst({ where: andWhere({ id }, ideaScopeWhere(access)) });
  return row ? toIdea(row) : null;
}

/** type/status-style defaults so a bare `{name}` is enough to create an idea, matching createProject. */
function withCreateDefaults(rawInput: unknown): unknown {
  if (typeof rawInput !== "object" || rawInput === null) return rawInput;
  const data = { ...(rawInput as Record<string, unknown>) };
  if (!data.status) data.status = "ACTIVE";
  return data;
}

export async function createIdea(rawInput: unknown): Promise<Idea> {
  const input = validateIdeaInput(withCreateDefaults(rawInput));
  const slug = await uniqueIdeaSlug(input.name);

  const row = await prisma.idea.create({
    data: {
      name: input.name,
      slug,
      description: input.description ?? null,
      status: input.status,
      owner: input.owner ?? null,
      technologies: JSON.stringify(input.technologies ?? []),
      tags: JSON.stringify(input.tags ?? []),
    },
  });

  await ensureOwnerName(input.owner);
  return toIdea(row);
}

/** Partial update, same merge-then-revalidate pattern as updateProjectFields in projects.ts. */
export async function updateIdeaFields(id: string, patch: unknown, access: AccessScope = ALL_ACCESS): Promise<Idea> {
  const existingRow = await prisma.idea.findFirst({ where: andWhere({ id }, ideaScopeWhere(access)) });
  if (!existingRow) {
    throw new IdeaNotFoundError(`Idea ${id} not found`);
  }
  const existing = toIdea(existingRow);
  const patchObj = typeof patch === "object" && patch !== null ? (patch as Record<string, unknown>) : {};

  const merged = {
    name: patchObj.name !== undefined ? patchObj.name : existing.name,
    description: patchObj.description !== undefined ? patchObj.description : existing.description,
    status: patchObj.status !== undefined ? patchObj.status : existing.status,
    owner: patchObj.owner !== undefined ? patchObj.owner : existing.owner,
    technologies: patchObj.technologies !== undefined ? patchObj.technologies : existing.technologies,
    tags: patchObj.tags !== undefined ? patchObj.tags : existing.tags,
  };

  const input = validateIdeaInput(merged);
  const slug = input.name === existingRow.name ? existingRow.slug : await uniqueIdeaSlug(input.name, id);

  const row = await prisma.idea.update({
    where: { id },
    data: {
      name: input.name,
      slug,
      description: input.description ?? null,
      status: input.status,
      owner: input.owner ?? null,
      technologies: JSON.stringify(input.technologies ?? []),
      tags: JSON.stringify(input.tags ?? []),
    },
  });

  await ensureOwnerName(input.owner);
  return toIdea(row);
}

export async function deleteIdeaById(id: string, access: AccessScope = ALL_ACCESS): Promise<void> {
  const visible = await prisma.idea.findFirst({ where: andWhere({ id }, ideaScopeWhere(access)), select: { id: true } });
  if (!visible) throw new IdeaNotFoundError(`Idea ${id} not found`);
  try {
    await prisma.idea.delete({ where: { id } });
    await removeTeam("IDEA", id);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      throw new IdeaNotFoundError(`Idea ${id} not found`);
    }
    throw error;
  }
}

/**
 * Turns an idea into a real project: creates a Project seeded from the
 * idea's own name/description/tags/technologies (via the same createProject
 * used everywhere else, so it gets the same defaults/validation), then marks
 * the idea PROMOTED and records which project it became. Not wrapped in a
 * transaction — Idea and Project are intentionally uncoupled models, and if
 * the idea-side update ever failed after a successful project create, the
 * worst case is a harmless extra project the user can see and manage normally.
 */
export async function promoteIdeaToProject(id: string, access: AccessScope = ALL_ACCESS) {
  const idea = await getIdeaById(id, access);
  if (!idea) {
    throw new IdeaNotFoundError(`Idea ${id} not found`);
  }
  if (idea.status === "PROMOTED") {
    throw new ValidationError({ status: "This idea has already been promoted." });
  }

  const project = await createProject({
    name: idea.name,
    description: idea.description,
    owner: idea.owner,
    tags: idea.tags,
    technologies: idea.technologies,
  });

  const row = await prisma.idea.update({
    where: { id },
    data: { status: "PROMOTED", promotedProjectId: project.id },
  });

  return { idea: toIdea(row), project };
}
