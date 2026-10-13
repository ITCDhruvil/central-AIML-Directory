import { NextRequest, NextResponse } from "next/server";
import { apiAuthorize } from "@/lib/auth/dal";
import { adminErrorResponse } from "@/lib/auth/adminHttp";
import { resetUserPassword } from "@/lib/auth/adminService";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Sets a new temporary password (returned once), forces a change at next login, and signs the user
 * out everywhere. Also closes any pending "forgot password" request from this user.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("users", "edit");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    return NextResponse.json({ temporaryPassword: await resetUserPassword(id, auth.user) });
  } catch (error) {
    return adminErrorResponse(error, "POST /api/admin/users/[id]/reset-password");
  }
}
