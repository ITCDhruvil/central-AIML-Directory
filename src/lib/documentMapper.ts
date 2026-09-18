import type { Documentation as DocumentationRow } from "@/generated/prisma/client";
import type { Documentation, DocumentCategory } from "@/types/documentation";

export function toDocumentation(row: DocumentationRow): Documentation {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    category: row.category as DocumentCategory,
    filePath: row.filePath,
    content: row.content,
    source: row.source,
    generatedFromContentHash: row.generatedFromContentHash,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
