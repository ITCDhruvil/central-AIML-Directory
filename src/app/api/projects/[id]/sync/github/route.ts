import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/projects";
import { listDocumentation } from "@/lib/documents";
import { GitHubApiError, importGitHubRepository } from "@/lib/github/client";
import { buildSyncPreview } from "@/lib/github/sync/preview";

type RouteParams = { params: Promise<{ id: string }> };

const STATUS_BY_CODE: Record<GitHubApiError["code"], number> = {
  not_found: 404,
  unauthorized: 401,
  rate_limited: 429,
  network: 502,
  unknown: 502,
};

/**
 * Fetches the current GitHub state for a project and diffs it against what's
 * stored. Read-only — never writes to the database.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const project = await getProjectById(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!project.githubOwner || !project.githubRepo) {
    return NextResponse.json({ error: "This project has no GitHub repository to sync." }, { status: 400 });
  }

  try {
    const storedDocs = await listDocumentation(project.id);
    const incoming = await importGitHubRepository(project.githubOwner, project.githubRepo);
    const preview = buildSyncPreview(project, storedDocs, incoming);
    return NextResponse.json(preview);
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return NextResponse.json({ error: error.message }, { status: STATUS_BY_CODE[error.code] });
    }
    console.error("POST /api/projects/[id]/sync/github failed", error);
    return NextResponse.json({ error: "Failed to sync with GitHub" }, { status: 500 });
  }
}
