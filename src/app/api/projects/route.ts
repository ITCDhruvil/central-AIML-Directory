import { audit } from "@/lib/audit";
import { apiAuthorize } from "@/lib/auth/dal";
import { NextRequest, NextResponse } from "next/server";
import { withOwnerDefault } from "@/lib/auth/ownerDefault";
import { andWhere, projectScopeWhere } from "@/lib/auth/scope";
import { prisma } from "@/lib/prisma";
import { addCreatorAsOwner, withTeams } from "@/lib/projectTeam";
import { toProject } from "@/lib/projectMapper";
import { buildProjectWhere, createProject } from "@/lib/projects";
import { ValidationError, validateDocumentsInput } from "@/lib/validation";

function extractDocumentsField(body: unknown): unknown {
  if (typeof body !== "object" || body === null) return undefined;
  return (body as Record<string, unknown>).documents;
}

export async function GET(request: NextRequest) {
  const auth = await apiAuthorize("projects", "view");
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const where = buildProjectWhere({
    q: searchParams.get("q")?.trim() ?? undefined,
    type: searchParams.get("type") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });

  try {
    const rows = await prisma.project.findMany({
      where: andWhere(where, projectScopeWhere(auth.access)),
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ projects: await withTeams(rows.map(toProject)) });
  } catch (error) {
    console.error("GET /api/projects failed", error);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await apiAuthorize("projects", "create");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const documents = validateDocumentsInput(extractDocumentsField(body));
    const project = await createProject(withOwnerDefault(body, auth.user, "projects"), documents);
    // Whoever creates a project is its first Owner.
    await addCreatorAsOwner("PROJECT", project.id, auth.user.id);
    await audit({ action: "project.created", actorId: auth.user.id, entityType: "project", entityId: project.id, meta: { name: project.name }, request });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("POST /api/projects failed", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
