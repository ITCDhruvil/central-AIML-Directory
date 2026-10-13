import { NextResponse } from "next/server";
import { apiAuthorize } from "@/lib/auth/dal";
import { listPendingResetRequests } from "@/lib/passwordResets";

/** Open "forgot password" requests, for the admin bell. Needs permission to edit users. */
export async function GET() {
  const auth = await apiAuthorize("users", "edit");
  if (!auth.ok) return auth.response;
  return NextResponse.json({ requests: await listPendingResetRequests() });
}
