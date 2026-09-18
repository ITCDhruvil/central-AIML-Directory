import { NextRequest, NextResponse } from "next/server";
import { getAIConfig } from "@/lib/ai/config";
import { callAssistantModelWithTools } from "@/lib/ai/client";
import { generateInsights, InsightsResponseError } from "@/lib/ai/insights";
import { INSIGHTS_TOOLS, INSIGHTS_TOOL_HANDLERS } from "@/lib/ai/insightsTools";
import { buildInsightsContext, InsightsContextNotFoundError } from "@/lib/ai/insightsContext";
import { buildInsightsUserMessage } from "@/lib/ai/insightsPrompts";
import { AIProviderError } from "@/lib/ai/types";
import { getLangSearchApiKey } from "@/lib/websearch/langsearch";
import { getInsightSnapshot, insightScope, persistGeneratedInsights } from "@/lib/insightCatalog";

function extractProjectId(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const value = (body as Record<string, unknown>).projectId;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Returns persisted insights for the catalog (or one project via `projectId`)
 * so a refresh still shows the last generation.
 */
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId")?.trim() || undefined;
  try {
    const snapshot = await getInsightSnapshot(insightScope(projectId));
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("GET /api/insights failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to load insights" }, { status: 500 });
  }
}

/**
 * Generates suggestions, then merges them into the saved catalog: matching
 * cards update in place, new ones are added, earlier cards are kept.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const config = getAIConfig();
  if (!config) {
    return NextResponse.json({ error: "AI is not configured. Set the AI API key to enable insights." }, { status: 503 });
  }

  const projectId = extractProjectId(body);
  const scope = insightScope(projectId);

  try {
    const [context, current] = await Promise.all([
      buildInsightsContext(projectId),
      getInsightSnapshot(scope),
    ]);
    const userMessage = buildInsightsUserMessage(
      context,
      current.insights.map((insight) => ({
        type: insight.type,
        title: insight.title,
        suggestedTool: insight.suggestedTool,
        relatedProjectName: insight.relatedProjectName,
      })),
    );
    const tools = getLangSearchApiKey() ? INSIGHTS_TOOLS : [];
    const suggestions = await generateInsights(userMessage, config, callAssistantModelWithTools, tools, INSIGHTS_TOOL_HANDLERS);
    const snapshot = await persistGeneratedInsights(scope, suggestions);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof InsightsContextNotFoundError) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (error instanceof AIProviderError) {
      console.error("POST /api/insights provider error", error.message);
      return NextResponse.json({ error: "The AI is temporarily unavailable. Please try again." }, { status: 502 });
    }
    if (error instanceof InsightsResponseError) {
      console.error("POST /api/insights malformed response", error.message);
      return NextResponse.json({ error: "The AI is temporarily unavailable. Please try again." }, { status: 502 });
    }
    console.error("POST /api/insights failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
  }
}
