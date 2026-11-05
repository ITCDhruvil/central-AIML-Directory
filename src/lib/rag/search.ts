import "server-only";
import { prisma } from "@/lib/prisma";
import { topK } from "@/lib/rag/vector";

export type RetrievedChunk = { documentId: string; content: string; score: number };

function parseVector(json: string): number[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** The top-k most similar chunks in a project to a query vector, highest score first. */
export async function retrieveChunks(projectId: string, queryVector: number[], k = 6): Promise<RetrievedChunk[]> {
  const rows = await prisma.documentChunk.findMany({ where: { projectId }, select: { documentId: true, content: true, embedding: true } });
  if (rows.length === 0) return [];
  return topK(
    queryVector,
    rows.map((r) => ({ item: r, vector: parseVector(r.embedding) })),
    k,
  ).map(({ item, score }) => ({ documentId: item.documentId, content: item.content, score }));
}

export async function projectHasIndex(projectId: string): Promise<boolean> {
  return (await prisma.documentChunk.count({ where: { projectId } })) > 0;
}
