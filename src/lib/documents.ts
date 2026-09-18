import { prisma } from "@/lib/prisma";
import { toDocumentation } from "@/lib/documentMapper";
import type { Documentation } from "@/types/documentation";

export async function listDocumentation(projectId: string): Promise<Documentation[]> {
  const rows = await prisma.documentation.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toDocumentation);
}

export async function getDocumentationById(
  projectId: string,
  documentId: string,
): Promise<Documentation | null> {
  const row = await prisma.documentation.findFirst({ where: { id: documentId, projectId } });
  return row ? toDocumentation(row) : null;
}
