import { NextRequest, NextResponse } from "next/server";
import { apiAuthorize } from "@/lib/auth/dal";
import { adminErrorResponse, badJson, readJson } from "@/lib/auth/adminHttp";
import { loadRoleMatrix, setRoleDefaults } from "@/lib/auth/adminService";

/** Effective permissions per role (built-in defaults plus any admin edits). */
export async function GET() {
  const auth = await apiAuthorize("users", "view");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ roles: await loadRoleMatrix() });
}

/** Replaces one role's defaults. Body: { role, permissions: { "projects:view": "ALL", ... } }. Only differences from the built-ins are stored. */
export async function PUT(request: NextRequest) {
  const auth = await apiAuthorize("users", "edit");
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (body === null) return badJson();
  const raw = typeof body === "object" ? (body as Record<string, unknown>) : {};

  try {
    return NextResponse.json({ roles: await setRoleDefaults(raw.role, raw.permissions, auth.user) });
  } catch (error) {
    return adminErrorResponse(error, "PUT /api/admin/permissions");
  }
}
