import { NextRequest, NextResponse } from "next/server";
import { guardedAi } from "@/lib/ai/guard";
import { apiAuthorize } from "@/lib/auth/dal";
import { getProjectById } from "@/lib/projects";
import { getDocumentationById } from "@/lib/documents";
import { indexDocumentById } from "@/lib/rag/indexer";

type RouteParams = { params: Promise<{ id: string; documentId: string }> };

/** Indexes (or re-indexes) one document for the project RAG. Returns its result so the UI can update that row live. */
export const POST = guardedAi("ai_project_assistant", async (_request: NextRequest, { params }: RouteParams) => {
  const auth = await apiAuthorize("projects", "edit");
  if (!auth.ok) return auth.response;
  const { id, documentId } = await params;
  const project = await getProjectById(id, auth.access);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const document = await getDocumentationById(id, documentId, auth.access);
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const result = await indexDocumentById(documentId);
  if (!result) return NextResponse.json({ error: "AI embeddings are not configured, so documents can't be indexed." }, { status: 503 });
  return NextResponse.json({ result });
});
