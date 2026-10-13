import { NextRequest, NextResponse } from "next/server";
import { apiAuthorize } from "@/lib/auth/dal";
import { dismissResetRequest } from "@/lib/passwordResets";

type RouteParams = { params: Promise<{ id: string }> };

/** Dismisses a request without resetting the password. (Resetting goes through /api/admin/users/[id]/reset-password, which also closes it.) */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("users", "edit");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const closed = await dismissResetRequest(id, auth.user.id);
  if (!closed) return NextResponse.json({ error: "That request is already closed." }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
