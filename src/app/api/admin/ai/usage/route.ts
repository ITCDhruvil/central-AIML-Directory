import { NextRequest, NextResponse } from "next/server";
import { apiAuthorize } from "@/lib/auth/dal";
import { getUsageReport } from "@/lib/ai/usageReport";

const ALLOWED_DAYS = [7, 14, 30, 90];

export async function GET(request: NextRequest) {
  const auth = await apiAuthorize("settings", "view");
  if (!auth.ok) return auth.response;

  const asked = Number(request.nextUrl.searchParams.get("days"));
  const days = ALLOWED_DAYS.includes(asked) ? asked : 7;
  try {
    return NextResponse.json(await getUsageReport(days));
  } catch (error) {
    console.error("GET /api/admin/ai/usage failed", error);
    return NextResponse.json({ error: "Failed to load usage" }, { status: 500 });
  }
}
