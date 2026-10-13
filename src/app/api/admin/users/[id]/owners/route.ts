import { NextRequest, NextResponse } from "next/server";
import { apiAuthorize } from "@/lib/auth/dal";
import { adminErrorResponse, badJson, readJson } from "@/lib/auth/adminHttp";
import { setUserOwners } from "@/lib/auth/adminService";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Sets which owner names belong to this user. Items owned by those names count as the user's "own".
 * An owner name can belong to one user, so linking it here moves it away from any previous user.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("users", "edit");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await readJson(request);
  if (body === null) return badJson();

  const ownerIds = typeof body === "object" && body !== null ? (body as Record<string, unknown>).ownerIds : null;
  if (!Array.isArray(ownerIds) || !ownerIds.every((v) => typeof v === "string")) {
    return NextResponse.json({ error: "ownerIds must be a list of owner ids." }, { status: 400 });
  }

  try {
    return NextResponse.json({ user: await setUserOwners(id, ownerIds as string[], auth.user) });
  } catch (error) {
    return adminErrorResponse(error, "PUT /api/admin/users/[id]/owners");
  }
}
