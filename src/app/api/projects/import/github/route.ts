import { NextRequest, NextResponse } from "next/server";
import { GitHubApiError, importGitHubRepository } from "@/lib/github/client";
import { parseGitHubRepoUrl } from "@/lib/github/parseUrl";

function extractGithubUrl(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as Record<string, unknown>).githubUrl;
  return typeof value === "string" ? value : null;
}

const STATUS_BY_CODE: Record<GitHubApiError["code"], number> = {
  not_found: 404,
  unauthorized: 401,
  rate_limited: 429,
  network: 502,
  unknown: 502,
};

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const githubUrl = extractGithubUrl(body);
  const parsed = githubUrl ? parseGitHubRepoUrl(githubUrl) : null;

  if (!parsed) {
    return NextResponse.json({ error: "Enter a valid GitHub repository URL." }, { status: 400 });
  }

  try {
    const result = await importGitHubRepository(parsed.owner, parsed.repo);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return NextResponse.json({ error: error.message }, { status: STATUS_BY_CODE[error.code] });
    }
    console.error("POST /api/projects/import/github failed", error);
    return NextResponse.json({ error: "Failed to import repository" }, { status: 500 });
  }
}
