import { NextRequest, NextResponse } from "next/server";
import { IdeaNotFoundError, promoteIdeaToProject } from "@/lib/ideas";
import { ValidationError } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

/** Turns an idea into a real project — see promoteIdeaToProject in lib/ideas.ts. */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const result = await promoteIdeaToProject(id);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof IdeaNotFoundError) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("POST /api/ideas/[id]/promote failed", error);
    return NextResponse.json({ error: "Failed to promote idea" }, { status: 500 });
  }
}
