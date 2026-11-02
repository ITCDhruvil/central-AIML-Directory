import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { callAssistantModel } from "@/lib/ai/client";
import { getAIConfig } from "@/lib/ai/config";
import { tryAi } from "@/lib/ai/guard";
import { autofillProjectImport } from "@/lib/ai/importAutofill";
import { apiAuthorize } from "@/lib/auth/dal";
import { withOwnerDefault } from "@/lib/auth/ownerDefault";
import { andWhere, projectScopeWhere } from "@/lib/auth/scope";
import { GitHubApiError, importGitHubRepository } from "@/lib/github/client";
import { requireGithubToken } from "@/lib/github/requireToken";
import { prisma } from "@/lib/prisma";
import { addCreatorAsOwner } from "@/lib/projectTeam";
import { createProject } from "@/lib/projects";
import { mergeSuggestedTechnologies } from "@/lib/technologyMerge";
import { ValidationError, validateDocumentsInput } from "@/lib/validation";
import type { ProjectInput } from "@/types/project";

// Fetching a repository's docs and drafting details with AI can take longer than a hosting platform's default limit.
export const maxDuration = 60;

const STATUS_BY_CODE: Record<GitHubApiError["code"], number> = {
  not_found: 404,
  unauthorized: 401,
  rate_limited: 429,
  network: 502,
  unknown: 502,
};

function parseFullName(value: unknown): { owner: string; repo: string } | null {
  if (typeof value !== "string") return null;
  const parts = value.trim().split("/").filter(Boolean);
  return parts.length === 2 ? { owner: parts[0], repo: parts[1] } : null;
}

/**
 * One-click "Add as project" for a repository on the person's own GitHub account: imports it, fills every detail it
 * can (AI drafts the description, tags and extra technologies when AI is available and allowed), creates the project
 * with its documents, and returns the id so the UI can open it. If the repository is already a project the person can
 * see, that project is returned instead of making a duplicate.
 */
export async function POST(request: NextRequest) {
  const auth = await apiAuthorize("projects", "create");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = parseFullName((body as Record<string, unknown> | null)?.fullName);
  if (!parsed) return NextResponse.json({ error: "fullName must be owner/repo" }, { status: 400 });

  const github = await requireGithubToken(auth.user.id);
  if ("response" in github) return github.response;

  const existing = await prisma.project.findFirst({
    where: andWhere(
      {
        githubOwner: { equals: parsed.owner, mode: "insensitive" },
        githubRepo: { equals: parsed.repo, mode: "insensitive" },
      },
      projectScopeWhere(auth.access),
    ),
    select: { id: true, name: true },
  });
  if (existing) return NextResponse.json({ project: existing, existing: true, ai: false });

  try {
    const imported = await importGitHubRepository(parsed.owner, parsed.repo, github.token);
    const { repository, readme, setupGuide } = imported;

    let description = repository.description?.trim() || null;
    let tags: string[] = [];
    let technologies = imported.technologies;

    // AI is a bonus: switched off, over quota, not configured or failing all just leave the imported details as they are.
    const config = getAIConfig();
    const draft = config
      ? await tryAi("ai_github_autofill", auth.user, () =>
          autofillProjectImport(
            {
              repoFullName: repository.fullName,
              target: "all",
              existingName: repository.name,
              existingDescription: description,
              existingTags: [],
              readme: readme.exists ? readme.content : "",
              detectedTechnologies: technologies.map((t) => t.name),
              onlyFill: ["description", "tags", "technologies"],
            },
            config,
            callAssistantModel,
          ),
        )
      : null;
    if (draft && draft.target === "all") {
      if (draft.description.trim()) description = draft.description.trim();
      tags = draft.tags;
      technologies = mergeSuggestedTechnologies(technologies, draft.suggestedTechnologies);
    }

    const documents = validateDocumentsInput([
      ...imported.documents,
      {
        title: setupGuide.title,
        category: setupGuide.category,
        filePath: setupGuide.filePath,
        content: setupGuide.content,
        source: setupGuide.source,
        generatedFromContent: setupGuide.content,
      },
    ]);

    const input: Partial<ProjectInput> = {
      name: repository.name,
      description,
      type: "PROJECT",
      status: "ACTIVE",
      owner: auth.user.name,
      githubUrl: repository.htmlUrl,
      githubOwner: repository.owner,
      githubRepo: repository.name,
      defaultBranch: repository.defaultBranch,
      technologies,
      tags,
    };
    const project = await createProject(withOwnerDefault(input, auth.user, "projects"), documents);
    await addCreatorAsOwner("PROJECT", project.id, auth.user.id);
    await audit({
      action: "project.created",
      actorId: auth.user.id,
      entityType: "project",
      entityId: project.id,
      meta: { name: project.name, source: "github-one-click" },
      request,
    });
    return NextResponse.json(
      { project: { id: project.id, name: project.name }, existing: false, ai: Boolean(draft) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return NextResponse.json({ error: error.message }, { status: STATUS_BY_CODE[error.code] });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("POST /api/github/repos/add failed", error);
    return NextResponse.json({ error: "Failed to add the repository as a project" }, { status: 500 });
  }
}
