import { NextRequest, NextResponse } from "next/server";
import { apiAuthorize } from "@/lib/auth/dal";
import { getProjectById } from "@/lib/projects";
import { TeamError, getTeam, setTeam } from "@/lib/projectTeam";
import { canManageProjectTeam } from "@/lib/projectTeamAccess";

type RouteParams = { params: Promise<{ id: string }> };

/** The project's team, plus whether the caller may change it. Emails are only shown to people who can manage the team. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("projects", "view");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const project = await getProjectById(id, auth.access);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const [team, canManage] = await Promise.all([getTeam("PROJECT", id), canManageProjectTeam(auth.user, project)]);
  return NextResponse.json({
    team: team.map((m) => ({ userId: m.userId, name: m.name, role: m.role, ...(canManage ? { email: m.email } : {}) })),
    canManage,
  });
}

/** Replaces the team. Body: { members: [{ userId, role: "OWNER" | "EDIT" | "VIEW" }] }. Needs an Owner or a wide editor. */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("projects", "edit");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const project = await getProjectById(id, auth.access);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!(await canManageProjectTeam(auth.user, project))) {
    return NextResponse.json({ error: "Only the project's owners (or a manager) can change its team." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const members = typeof body === "object" && body !== null ? (body as Record<string, unknown>).members : null;

  try {
    const team = await setTeam("PROJECT", id, members, auth.user.id);
    return NextResponse.json({
      team: team.map((m) => ({ userId: m.userId, name: m.name, email: m.email, role: m.role })),
      canManage: true,
    });
  } catch (error) {
    if (error instanceof TeamError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("PUT /api/projects/[id]/team failed", error);
    return NextResponse.json({ error: "Failed to update the team" }, { status: 500 });
  }
}
