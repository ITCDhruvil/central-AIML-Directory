import { NextRequest, NextResponse } from "next/server";
import { apiAuthorize } from "@/lib/auth/dal";
import { adminErrorResponse, badJson, readJson } from "@/lib/auth/adminHttp";
import { setUserOverrides } from "@/lib/auth/adminService";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Applies per-user permission overrides. Body: { overrides: { "projects:view": "ALL" | "OWN" | "NONE" | null } }.
 * A null value removes the override so the user inherits their role's default again.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("users", "edit");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await readJson(request);
  if (body === null) return badJson();

  try {
    const overrides = typeof body === "object" ? (body as Record<string, unknown>).overrides : null;
    return NextResponse.json({ overrides: await setUserOverrides(id, overrides, auth.user) });
  } catch (error) {
    return adminErrorResponse(error, "PUT /api/admin/users/[id]/permissions");
  }
}
