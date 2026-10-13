import { prisma } from "@/lib/prisma";
import { toDocumentation } from "@/lib/documentMapper";
import { ALL_ACCESS, andWhere, projectScopeWhere, type AccessScope } from "@/lib/auth/scope";
import { DOCUMENT_SEARCH_FIELDS, orContainsFields } from "@/lib/schemaSearch";
import { DOCUMENT_CATEGORIES, type Documentation } from "@/types/documentation";

export interface DocumentationFilters {
  q?: string;
  projectId?: string;
  category?: string;
}

export type DocumentationWithProject = Documentation & { projectName: string };

export function buildDocumentationWhere(filters: DocumentationFilters) {
  const clauses: Record<string, unknown>[] = [];

  if (filters.q?.trim()) {
    clauses.push({ OR: orContainsFields(DOCUMENT_SEARCH_FIELDS, filters.q) });
  }
  if (filters.projectId) clauses.push({ projectId: filters.projectId });
  if (filters.category && DOCUMENT_CATEGORIES.includes(filters.category as (typeof DOCUMENT_CATEGORIES)[number])) {
    clauses.push({ category: filters.category });
  }

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { AND: clauses };
}

export async function listDocumentation(projectId: string, access: AccessScope = ALL_ACCESS): Promise<Documentation[]> {
  const rows = await prisma.documentation.findMany({
    where: andWhere({ projectId }, documentScopeWhere(access)),
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toDocumentation);
}

/** Documents inherit visibility from their project: `access` is applied to the parent project. */
function documentScopeWhere(access: AccessScope): Record<string, unknown> {
  return access.all ? {} : { project: projectScopeWhere(access) };
}

export async function searchDocumentation(
  filters: DocumentationFilters = {},
  access: AccessScope = ALL_ACCESS,
): Promise<DocumentationWithProject[]> {
  const rows = await prisma.documentation.findMany({
    where: andWhere(buildDocumentationWhere(filters), documentScopeWhere(access)),
    include: { project: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });
  return rows.map((row) => ({ ...toDocumentation(row), projectName: row.project.name }));
}

export async function getDocumentationById(
  projectId: string,
  documentId: string,
  access: AccessScope = ALL_ACCESS,
): Promise<Documentation | null> {
  const row = await prisma.documentation.findFirst({
    where: andWhere({ id: documentId, projectId }, documentScopeWhere(access)),
  });
  return row ? toDocumentation(row) : null;
}

export async function getDocumentationRecord(
  id: string,
  access: AccessScope = ALL_ACCESS,
): Promise<DocumentationWithProject | null> {
  const row = await prisma.documentation.findFirst({
    where: andWhere({ id }, documentScopeWhere(access)),
    include: { project: { select: { id: true, name: true } } },
  });
  return row ? { ...toDocumentation(row), projectName: row.project.name } : null;
}
