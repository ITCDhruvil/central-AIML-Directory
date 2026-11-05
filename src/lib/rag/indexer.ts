import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { approxTokens, chunkText } from "@/lib/rag/chunk";
import { embedTexts, EMBEDDING_MODEL } from "@/lib/ai/embeddings";
import { extractDocumentText } from "@/lib/rag/extractText";
import { getAIConfig } from "@/lib/ai/config";
import type { AIConfig } from "@/lib/ai/types";

export type IndexStatus = "INDEXED" | "EMPTY" | "FAILED";
export type IndexResult = { documentId: string; status: IndexStatus; chunkCount: number; skipped: boolean };

type DocRow = { id: string; projectId: string; source: string; content: string; title: string };

function hashOf(text: string): string {
  return createHash("sha256").update(text).update(`|${EMBEDDING_MODEL}`).digest("hex");
}

async function writeIndex(doc: DocRow, contentHash: string, chunkCount: number, status: IndexStatus, error: string | null): Promise<void> {
  await prisma.documentIndex.upsert({
    where: { documentId: doc.id },
    create: { documentId: doc.id, projectId: doc.projectId, contentHash, model: EMBEDDING_MODEL, chunkCount, status, error },
    update: { contentHash, model: EMBEDDING_MODEL, chunkCount, status, error },
  });
}

/**
 * Indexes one document for RAG: extract text → hash → (skip if unchanged) → chunk → embed → replace its chunks.
 * Best-effort: any failure is recorded on the DocumentIndex row rather than thrown, so an upload never breaks on it.
 */
export async function indexDocument(doc: DocRow, config: AIConfig): Promise<IndexResult> {
  let text: string;
  try {
    text = (await extractDocumentText(doc)).trim();
  } catch (error) {
    await writeIndex(doc, "", 0, "FAILED", `Could not read the file: ${error instanceof Error ? error.message : "unknown error"}`);
    return { documentId: doc.id, status: "FAILED", chunkCount: 0, skipped: false };
  }

  const contentHash = hashOf(text);
  const existing = await prisma.documentIndex.findUnique({ where: { documentId: doc.id } });
  // Skip when nothing that affects the index has changed (same text + same model), unless it previously failed.
  if (existing && existing.contentHash === contentHash && existing.status !== "FAILED") {
    return { documentId: doc.id, status: existing.status as IndexStatus, chunkCount: existing.chunkCount, skipped: true };
  }

  if (!text) {
    await prisma.documentChunk.deleteMany({ where: { documentId: doc.id } });
    await writeIndex(doc, contentHash, 0, "EMPTY", null);
    return { documentId: doc.id, status: "EMPTY", chunkCount: 0, skipped: false };
  }

  const chunks = chunkText(text);
  let vectors: number[][];
  try {
    vectors = await embedTexts(chunks, config);
  } catch (error) {
    await writeIndex(doc, contentHash, 0, "FAILED", error instanceof Error ? error.message : "Embedding failed");
    return { documentId: doc.id, status: "FAILED", chunkCount: 0, skipped: false };
  }

  await prisma.$transaction([
    prisma.documentChunk.deleteMany({ where: { documentId: doc.id } }),
    prisma.documentChunk.createMany({
      data: chunks.map((content, i) => ({
        projectId: doc.projectId,
        documentId: doc.id,
        chunkIndex: i,
        content,
        embedding: JSON.stringify(vectors[i]),
        tokens: approxTokens(content),
      })),
    }),
  ]);
  await writeIndex(doc, contentHash, chunks.length, "INDEXED", null);
  return { documentId: doc.id, status: "INDEXED", chunkCount: chunks.length, skipped: false };
}

const DOC_SELECT = { id: true, projectId: true, source: true, content: true, title: true } as const;

/** Indexes one document by id (used after an upload or edit). No-op when AI/embeddings aren't configured. */
export async function indexDocumentById(documentId: string): Promise<IndexResult | null> {
  const config = getAIConfig();
  if (!config) return null;
  const row = await prisma.documentation.findUnique({ where: { id: documentId }, select: DOC_SELECT });
  if (!row) return null;
  return indexDocument(row, config);
}

export type ProjectIndexSummary = { indexed: number; skipped: number; empty: number; failed: number; total: number };

/** Indexes every document in a project, skipping unchanged ones. Best-effort per document. */
export async function indexProject(projectId: string): Promise<ProjectIndexSummary | null> {
  const config = getAIConfig();
  if (!config) return null;
  const rows = await prisma.documentation.findMany({ where: { projectId }, select: DOC_SELECT });
  const summary: ProjectIndexSummary = { indexed: 0, skipped: 0, empty: 0, failed: 0, total: rows.length };
  for (const row of rows) {
    const result = await indexDocument(row, config);
    if (result.skipped) summary.skipped += 1;
    else if (result.status === "INDEXED") summary.indexed += 1;
    else if (result.status === "EMPTY") summary.empty += 1;
    else summary.failed += 1;
  }
  return summary;
}

export type ProjectIndexStatus = {
  total: number;
  indexed: number;
  failed: number;
  empty: number;
  pending: number;
  chunks: number;
  lastIndexedAt: string | null;
  configured: boolean;
};

/** A snapshot of how much of a project's documentation is indexed, for the UI. */
export async function getProjectIndexStatus(projectId: string): Promise<ProjectIndexStatus> {
  const [total, rows, chunks] = await Promise.all([
    prisma.documentation.count({ where: { projectId } }),
    prisma.documentIndex.findMany({ where: { projectId }, select: { status: true, chunkCount: true, indexedAt: true } }),
    prisma.documentChunk.count({ where: { projectId } }),
  ]);
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const last = rows.reduce<Date | null>((m, r) => (!m || r.indexedAt > m ? r.indexedAt : m), null);
  return {
    total,
    indexed: count("INDEXED"),
    failed: count("FAILED"),
    empty: count("EMPTY"),
    pending: total - rows.length,
    chunks,
    lastIndexedAt: last ? last.toISOString() : null,
    configured: getAIConfig() !== null,
  };
}
