import { audit } from "@/lib/audit";
import { apiAuthorize } from "@/lib/auth/dal";
import { NextRequest, NextResponse } from "next/server";
import { ProjectNotFoundError, deleteProjectById, getProjectById, updateProjectFields } from "@/lib/projects";
import { ValidationError } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("projects", "view");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const project = await getProjectById(id, auth.access);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ project });
  } catch (error) {
    console.error("GET /api/projects/[id] failed", error);
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("projects", "edit");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const project = await updateProjectFields(id, body, auth.access);
    await audit({
      action: "project.updated",
      actorId: auth.user.id,
      entityType: "project",
      entityId: id,
      meta: { name: project.name, fields: typeof body === "object" && body !== null ? Object.keys(body) : [] },
      request,
    });
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

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("projects", "delete");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const before = await getProjectById(id, auth.access);
    await deleteProjectById(id, auth.access);
    await audit({ action: "project.deleted", actorId: auth.user.id, entityType: "project", entityId: id, meta: { name: before?.name }, request });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    console.error("DELETE /api/projects/[id] failed", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
