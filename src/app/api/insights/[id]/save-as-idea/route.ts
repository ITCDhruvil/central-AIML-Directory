import { NextRequest, NextResponse } from "next/server";
import { InsightNotFoundError, saveInsightAsIdea } from "@/lib/insightCatalog";
import { ValidationError } from "@/lib/validation";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
