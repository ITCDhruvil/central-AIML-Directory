import { NextRequest, NextResponse } from "next/server";
import { guardedAi } from "@/lib/ai/guard";
import { apiAuthorize } from "@/lib/auth/dal";
import { getProjectById } from "@/lib/projects";
import { getProjectIndexStatus, indexProject } from "@/lib/rag/indexer";

type RouteParams = { params: Promise<{ id: string }> };

/** How much of the project's documentation is indexed for Ask AI. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("projects", "view");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const project = await getProjectById(id, auth.access);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ status: await getProjectIndexStatus(id) });
}

/** Indexes every document in the project (skipping unchanged ones). Needs project edit rights. */
export const POST = guardedAi("ai_project_assistant", async (_request: NextRequest, { params }: RouteParams) => {
  const auth = await apiAuthorize("projects", "edit");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const project = await getProjectById(id, auth.access);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const summary = await indexProject(id);
  if (!summary) return NextResponse.json({ error: "AI embeddings are not configured, so documents can't be indexed." }, { status: 503 });
  return NextResponse.json({ summary, status: await getProjectIndexStatus(id) });
});
