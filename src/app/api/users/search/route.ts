import { NextRequest, NextResponse } from "next/server";
import { apiAuthorize } from "@/lib/auth/dal";
import { searchActiveUsers } from "@/lib/projectTeam";

/**
 * People picker for project teams: active users matching a name/email fragment. Limited to people who can
 * edit projects, since choosing a team member is part of editing one. Returns only id, name and email.
 */
export async function GET(request: NextRequest) {
  const auth = await apiAuthorize("projects", "edit");
  if (!auth.ok) return auth.response;

  const q = request.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json({ users: await searchActiveUsers(q) });
}
