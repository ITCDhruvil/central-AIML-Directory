import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordProjectActivity } from "@/lib/projectActivity";
import { toProject } from "@/lib/projectMapper";
import { getProjectById } from "@/lib/projects";
import { listDocumentation } from "@/lib/documents";
import { GitHubApiError, importGitHubRepository } from "@/lib/github/client";
import { buildSyncPreview } from "@/lib/github/sync/preview";
import { mergeTechnologies } from "@/lib/github/sync/compare";
import { GENERATED_SETUP_GUIDE_PATH } from "@/lib/github/setup/builder";
import { sha256 } from "@/lib/hash";
import type { ApplySyncRequest } from "@/lib/github/sync/types";

type RouteParams = { params: Promise<{ id: string }> };

const STATUS_BY_CODE: Record<GitHubApiError["code"], number> = {
  not_found: 404,
  unauthorized: 401,
  rate_limited: 429,
  network: 502,
  unknown: 502,
};

const STALE_PREVIEW_MESSAGE = "The project changed after this sync preview was generated. Please sync again.";

class StaleProjectError extends Error {}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function parseApplyRequest(body: unknown): ApplySyncRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.projectUpdatedAt !== "string") return null;

  const documents = typeof b.documents === "object" && b.documents !== null ? (b.documents as Record<string, unknown>) : {};
  const technologies =
    typeof b.technologies === "object" && b.technologies !== null ? (b.technologies as Record<string, unknown>) : {};
  const setupGuide =
    typeof b.setupGuide === "object" && b.setupGuide !== null ? (b.setupGuide as Record<string, unknown>) : {};

  return {
    projectUpdatedAt: b.projectUpdatedAt,
    applyRepositoryMetadata: b.applyRepositoryMetadata === true,
    applyReadme: b.applyReadme === true,
    documents: {
      add: toStringArray(documents.add),
      update: toStringArray(documents.update),
      remove: toStringArray(documents.remove),
    },
    technologies: { applyDetectedChanges: technologies.applyDetectedChanges === true },
    setupGuide: { applyGeneratedUpdate: setupGuide.applyGeneratedUpdate === true },
  };
}

/**
 * Applies a previously-previewed GitHub sync. Re-fetches GitHub and
 * re-computes the diff itself (never trusts client-supplied content) — the
 * request only carries which categories the user selected. Transactional;
 * rejects with 409 if the project changed since the preview was generated.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const applyRequest = parseApplyRequest(body);
  if (!applyRequest) {
    return NextResponse.json({ error: "Invalid sync apply request" }, { status: 400 });
  }

  const project = await getProjectById(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!project.githubOwner || !project.githubRepo) {
    return NextResponse.json({ error: "This project has no GitHub repository to sync." }, { status: 400 });
  }
  if (project.updatedAt !== applyRequest.projectUpdatedAt) {
    return NextResponse.json({ error: STALE_PREVIEW_MESSAGE }, { status: 409 });
  }

  try {
    const storedDocs = await listDocumentation(project.id);
    const incoming = await importGitHubRepository(project.githubOwner, project.githubRepo);
    const preview = buildSyncPreview(project, storedDocs, incoming);

    const updatedRow = await prisma.$transaction(async (tx) => {
      const fresh = await tx.project.findUnique({ where: { id: project.id } });
      if (!fresh || fresh.updatedAt.toISOString() !== applyRequest.projectUpdatedAt) {
        throw new StaleProjectError();
      }

      const updateData: Record<string, unknown> = { lastSyncedAt: new Date() };

      if (applyRequest.applyRepositoryMetadata && preview.repository.changed) {
        updateData.githubOwner = preview.repository.incoming.githubOwner;
        updateData.githubRepo = preview.repository.incoming.githubRepo;
        updateData.defaultBranch = preview.repository.incoming.defaultBranch;
      }

      if (applyRequest.technologies.applyDetectedChanges) {
        const merged = mergeTechnologies(preview.technologies.detected, preview.technologies.manual);
        updateData.technologies = JSON.stringify(merged);
      }

      const updated = await tx.project.update({ where: { id: project.id }, data: updateData });

      if (applyRequest.applyReadme && preview.readme.changed && incoming.readme.exists) {
        await tx.documentation.upsert({
          where: { projectId_filePath: { projectId: project.id, filePath: "README.md" } },
          create: {
            projectId: project.id,
            title: "README",
            category: "README",
            filePath: "README.md",
            content: incoming.readme.content,
            source: "github",
          },
          update: { content: incoming.readme.content },
        });
      }

      const wantedPaths = new Set([...applyRequest.documents.add, ...applyRequest.documents.update]);
      if (wantedPaths.size > 0) {
        const toApply = incoming.documents.filter(
          (d) => wantedPaths.has(d.filePath) && !(d.category === "README" && d.filePath === "README.md"),
        );
        for (const doc of toApply) {
          await tx.documentation.upsert({
            where: { projectId_filePath: { projectId: project.id, filePath: doc.filePath } },
            create: {
              projectId: project.id,
              title: doc.title,
              category: doc.category,
              filePath: doc.filePath,
              content: doc.content,
              source: "github",
            },
            update: { title: doc.title, category: doc.category, content: doc.content },
          });
        }
      }

      if (applyRequest.documents.remove.length > 0) {
        const removeIds = new Set(applyRequest.documents.remove);
        // Only ever remove docs the fresh diff itself confirmed are gone from GitHub —
        // never trust a client-supplied id blindly.
        const removable = preview.documents.removed.filter((d) => removeIds.has(d.documentId));
        for (const doc of removable) {
          await tx.documentation.delete({ where: { id: doc.documentId } });
        }
      }

      if (applyRequest.setupGuide.applyGeneratedUpdate && !preview.setupGuide.userModified) {
        const hash = sha256(incoming.setupGuide.content);
        await tx.documentation.upsert({
          where: { projectId_filePath: { projectId: project.id, filePath: GENERATED_SETUP_GUIDE_PATH } },
          create: {
            projectId: project.id,
            title: incoming.setupGuide.title,
            category: incoming.setupGuide.category,
            filePath: incoming.setupGuide.filePath,
            content: incoming.setupGuide.content,
            source: "generated",
            generatedFromContentHash: hash,
          },
          update: { content: incoming.setupGuide.content, generatedFromContentHash: hash },
        });
      }

      await recordProjectActivity(tx, project.id, "GITHUB_SYNCED", "Synced from GitHub");

      return updated;
    });

    return NextResponse.json({ project: toProject(updatedRow) });
  } catch (error) {
    if (error instanceof StaleProjectError) {
      return NextResponse.json({ error: STALE_PREVIEW_MESSAGE }, { status: 409 });
    }
    if (error instanceof GitHubApiError) {
      return NextResponse.json({ error: error.message }, { status: STATUS_BY_CODE[error.code] });
    }
    console.error("POST /api/projects/[id]/sync/github/apply failed", error);
    return NextResponse.json({ error: "Failed to apply sync" }, { status: 500 });
  }
}
