import type { Documentation as DocumentationRow } from "@/generated/prisma/client";
import type { Documentation, DocumentCategory } from "@/types/documentation";

export function toDocumentation(
  row: DocumentationRow & { file?: { fileName: string; size: number; contentType: string } | null },
): Documentation {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    category: row.category as DocumentCategory,
    filePath: row.filePath,
    content: row.content,
    source: row.source,
    generatedFromContentHash: row.generatedFromContentHash,
    file: row.file ? { name: row.file.fileName, size: row.file.size, contentType: row.file.contentType } : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
