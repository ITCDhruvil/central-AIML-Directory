import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toProject } from "@/lib/projectMapper";
import { buildProjectWhere, createProject } from "@/lib/projects";
import { ValidationError, validateDocumentsInput } from "@/lib/validation";

function extractDocumentsField(body: unknown): unknown {
  if (typeof body !== "object" || body === null) return undefined;
  return (body as Record<string, unknown>).documents;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const where = buildProjectWhere({
    q: searchParams.get("q")?.trim() ?? undefined,
    type: searchParams.get("type") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });

  try {
    const rows = await prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ projects: rows.map(toProject) });
  } catch (error) {
    console.error("GET /api/projects failed", error);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const documents = validateDocumentsInput(extractDocumentsField(body));
    const project = await createProject(body, documents);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("POST /api/projects failed", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
