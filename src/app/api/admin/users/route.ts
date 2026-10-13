import { NextRequest, NextResponse } from "next/server";
import { apiAuthorize } from "@/lib/auth/dal";
import { adminErrorResponse, badJson, readJson } from "@/lib/auth/adminHttp";
import { createUser, listAdminUsers } from "@/lib/auth/adminService";

export async function GET() {
  const auth = await apiAuthorize("users", "view");
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json({ users: await listAdminUsers() });
  } catch (error) {
    return adminErrorResponse(error, "GET /api/admin/users");
  }
}

/**
 * Creates a user. The admin may choose the password and per-user permission overrides in the same call.
 * With no password a temporary one is generated and returned once. By default the user must change it at first sign-in.
 */
export async function POST(request: NextRequest) {
  const auth = await apiAuthorize("users", "create");
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (body === null) return badJson();

  try {
    const { user, generatedPassword } = await createUser(body, auth.user);
    return NextResponse.json(
      { user, ...(generatedPassword ? { temporaryPassword: generatedPassword } : {}) },
      { status: 201 },
    );
  } catch (error) {
    return adminErrorResponse(error, "POST /api/admin/users");
  }
}
