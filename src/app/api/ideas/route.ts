import { audit } from "@/lib/audit";
import { apiAuthorize } from "@/lib/auth/dal";
import { NextRequest, NextResponse } from "next/server";
import { withOwnerDefault } from "@/lib/auth/ownerDefault";
import { createIdea, listIdeas } from "@/lib/ideas";
import { ValidationError } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const auth = await apiAuthorize("ideas", "view");
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  try {
    const ideas = await listIdeas(
      {
        q: searchParams.get("q")?.trim() ?? undefined,
        status: searchParams.get("status") ?? undefined,
      },
      auth.access,
    );
    return NextResponse.json({ ideas });
  } catch (error) {
    console.error("GET /api/ideas failed", error);
    return NextResponse.json({ error: "Failed to load ideas" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await apiAuthorize("ideas", "create");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const idea = await createIdea(withOwnerDefault(body, auth.user, "ideas"));
    await audit({ action: "idea.created", actorId: auth.user.id, entityType: "idea", entityId: idea.id, meta: { name: idea.name }, request });
    return NextResponse.json({ idea }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("POST /api/ideas failed", error);
    return NextResponse.json({ error: "Failed to create idea" }, { status: 500 });
  }
}
