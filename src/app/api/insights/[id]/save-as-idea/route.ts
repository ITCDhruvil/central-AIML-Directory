import { apiAuthorize, denyUnlessFullAccess } from "@/lib/auth/dal";
import { NextRequest, NextResponse } from "next/server";
import { InsightNotFoundError, saveInsightAsIdea } from "@/lib/insightCatalog";
import { ValidationError } from "@/lib/validation";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await apiAuthorize("ideas", "create");
  if (!auth.ok) return auth.response;
  // Insight cards are directory-wide, so reading one needs insights access too.
  const insightsAuth = await apiAuthorize("insights", "view");
  if (!insightsAuth.ok) return insightsAuth.response;
  const denied = denyUnlessFullAccess(insightsAuth);
  if (denied) return denied;

  const { id } = await context.params;
  try {
    const insight = await saveInsightAsIdea(id);
    return NextResponse.json({ insight });
  } catch (error) {
    if (error instanceof InsightNotFoundError) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("POST /api/insights/[id]/save-as-idea failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to save as idea" }, { status: 500 });
  }
}
