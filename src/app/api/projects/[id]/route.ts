import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toProject } from "@/lib/projectMapper";
import { ProjectNotFoundError, deleteProjectById, updateProjectFields } from "@/lib/projects";
import { ValidationError } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const row = await prisma.project.findUnique({ where: { id } });
    if (!row) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ project: toProject(row) });
  } catch (error) {
    console.error("GET /api/projects/[id] failed", error);
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const project = await updateProjectFields(id, body);
    return NextResponse.json({ project });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    if (error instanceof ProjectNotFoundError) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    console.error("PUT /api/projects/[id] failed", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    await deleteProjectById(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    console.error("DELETE /api/projects/[id] failed", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
