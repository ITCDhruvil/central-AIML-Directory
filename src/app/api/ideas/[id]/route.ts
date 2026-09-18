import { NextRequest, NextResponse } from "next/server";
import { IdeaNotFoundError, deleteIdeaById, getIdeaById, updateIdeaFields } from "@/lib/ideas";
import { ValidationError } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const idea = await getIdeaById(id);
    if (!idea) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }
    return NextResponse.json({ idea });
  } catch (error) {
    console.error("GET /api/ideas/[id] failed", error);
    return NextResponse.json({ error: "Failed to load idea" }, { status: 500 });
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
    const idea = await updateIdeaFields(id, body);
    return NextResponse.json({ idea });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    if (error instanceof IdeaNotFoundError) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }
    console.error("PUT /api/ideas/[id] failed", error);
    return NextResponse.json({ error: "Failed to update idea" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    await deleteIdeaById(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof IdeaNotFoundError) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }
    console.error("DELETE /api/ideas/[id] failed", error);
    return NextResponse.json({ error: "Failed to delete idea" }, { status: 500 });
  }
}
