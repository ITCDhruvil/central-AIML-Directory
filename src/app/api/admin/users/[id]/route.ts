import { NextRequest, NextResponse } from "next/server";
import { apiAuthorize } from "@/lib/auth/dal";
import { adminErrorResponse, badJson, readJson } from "@/lib/auth/adminHttp";
import { deleteUser, getAdminUser, getUserOverrides, updateUser } from "@/lib/auth/adminService";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("users", "view");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const user = await getAdminUser(id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ user, overrides: await getUserOverrides(id) });
}

/** Updates name, role or active status. Refuses changes that would leave the app without an active admin. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("users", "edit");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await readJson(request);
  if (body === null) return badJson();

  try {
    return NextResponse.json({ user: await updateUser(id, body, auth.user) });
  } catch (error) {
    return adminErrorResponse(error, "PATCH /api/admin/users/[id]");
  }
}

/** Permanently deletes a user (not yourself, not the last active admin). Deactivating is the reversible option. */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("users", "delete");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    await deleteUser(id, auth.user);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return adminErrorResponse(error, "DELETE /api/admin/users/[id]");
  }
}
