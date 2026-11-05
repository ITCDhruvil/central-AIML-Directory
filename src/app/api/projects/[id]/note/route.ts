import { apiAuthorize } from "@/lib/auth/dal";
import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/projects";
import { getProjectNote, saveProjectNote, MAX_NOTE_LENGTH } from "@/lib/projectNote";

type RouteParams = { params: Promise<{ id: string }> };

/** The project's shared notepad. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("projects", "view");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const project = await getProjectById(id, auth.access);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json({ note: await getProjectNote(id) });
}

/** Replaces the notepad's content. Body: { content: string }. Needs project edit rights. */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("projects", "edit");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const project = await getProjectById(id, auth.access);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const content = typeof body === "object" && body !== null ? (body as Record<string, unknown>).content : undefined;
  if (typeof content !== "string") return NextResponse.json({ error: "content must be a string" }, { status: 400 });
  if (content.length > MAX_NOTE_LENGTH) {
    return NextResponse.json({ error: `The note is too long (limit ${Math.round(MAX_NOTE_LENGTH / 1000)}k characters).` }, { status: 400 });
  }

  return NextResponse.json({ note: await saveProjectNote(id, content, auth.user.name) });
}
