import type { Idea as IdeaRow } from "@/generated/prisma/client";
import type { Idea } from "@/types/idea";
import { parseStringArray, parseTechnologies } from "@/lib/projectMapper";

export function toIdea(row: IdeaRow): Idea {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    status: row.status as Idea["status"],
    owner: row.owner,
    technologies: parseTechnologies(row.technologies),
    tags: parseStringArray(row.tags),
    promotedProjectId: row.promotedProjectId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
