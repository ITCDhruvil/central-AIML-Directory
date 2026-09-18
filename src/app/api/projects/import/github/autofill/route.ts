import { NextRequest, NextResponse } from "next/server";
import { getAIConfig } from "@/lib/ai/config";
import { callAssistantModel } from "@/lib/ai/client";
import { autofillProjectImport, ImportAutofillResponseError } from "@/lib/ai/importAutofill";
import { AUTOFILL_FIELD_TARGETS, AUTOFILL_TARGETS, type AutofillFieldTarget, type AutofillTarget } from "@/lib/ai/importAutofillPrompts";
import { AIProviderError } from "@/lib/ai/types";
import { fetchRepositoryReadme, GitHubApiError } from "@/lib/github/client";

const STATUS_BY_CODE: Record<GitHubApiError["code"], number> = {
  not_found: 404,
  unauthorized: 401,
  rate_limited: 429,
  network: 502,
  unknown: 502,
};

function parseRepoFullName(value: string): { owner: string; repo: string } | null {
  const parts = value.split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  const [owner, repo] = parts;
  if (!owner || !repo) return null;
  return { owner, repo };
}

/**
 * Opt-in per-field AI fill. Uses a client-supplied README when available
 * (post-import); otherwise fetches the README from GitHub for the given repo.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }
  const data = body as Record<string, unknown>;

  const repoFullName = typeof data.repoFullName === "string" ? data.repoFullName.trim() : "";
  const parsedRepo = parseRepoFullName(repoFullName);
  if (!parsedRepo) {
    return NextResponse.json({ error: "repoFullName must be owner/repo" }, { status: 400 });
  }

  const target = typeof data.target === "string" ? data.target : "";
  if (!AUTOFILL_TARGETS.includes(target as AutofillTarget)) {
    return NextResponse.json(
      { error: `target must be one of ${AUTOFILL_TARGETS.join(", ")}` },
      { status: 400 },
    );
  }

  let readme = typeof data.readme === "string" ? data.readme : "";
  const existingName =
    typeof data.existingName === "string" && data.existingName.trim() ? data.existingName.trim() : null;
  const existingDescription =
    typeof data.existingDescription === "string" && data.existingDescription.trim()
      ? data.existingDescription.trim()
      : null;
  const existingTags = Array.isArray(data.existingTags)
    ? data.existingTags.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean)
    : [];
  const detectedTechnologies = Array.isArray(data.detectedTechnologies)
    ? data.detectedTechnologies.filter((t): t is string => typeof t === "string")
    : [];
  const onlyFill = Array.isArray(data.onlyFill)
    ? data.onlyFill.filter((f): f is AutofillFieldTarget =>
        typeof f === "string" && (AUTOFILL_FIELD_TARGETS as readonly string[]).includes(f),
      )
    : undefined;

  const config = getAIConfig();
  if (!config) {
    return NextResponse.json(
      { error: "AI autofill is not configured. Set the AI API key to enable it." },
      { status: 503 },
    );
  }

  try {
    if (!readme.trim()) {
      const fetched = await fetchRepositoryReadme(parsedRepo.owner, parsedRepo.repo);
      readme = fetched.content;
    }

    const result = await autofillProjectImport(
      {
        repoFullName,
        target: target as AutofillTarget,
        existingName,
        existingDescription,
        existingTags,
        readme,
        detectedTechnologies,
        onlyFill,
      },
      config,
      callAssistantModel,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return NextResponse.json({ error: error.message }, { status: STATUS_BY_CODE[error.code] });
    }
    if (error instanceof AIProviderError) {
      console.error("POST /api/projects/import/github/autofill provider error", error.message);
      return NextResponse.json(
        { error: "The AI autofill is temporarily unavailable. Please try again." },
        { status: 502 },
      );
    }
    if (error instanceof ImportAutofillResponseError) {
      console.error("POST /api/projects/import/github/autofill malformed response", error.message);
      return NextResponse.json(
        { error: "The AI autofill is temporarily unavailable. Please try again." },
        { status: 502 },
      );
    }
    console.error("POST /api/projects/import/github/autofill failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to auto-fill" }, { status: 500 });
  }
}
