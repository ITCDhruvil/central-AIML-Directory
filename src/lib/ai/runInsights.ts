import "server-only";
import { callAssistantModelWithTools } from "@/lib/ai/client";
import { getAIConfig } from "@/lib/ai/config";
import { generateInsights } from "@/lib/ai/insights";
import { buildInsightsContext } from "@/lib/ai/insightsContext";
import { buildInsightsUserMessage } from "@/lib/ai/insightsPrompts";
import { INSIGHTS_TOOL_HANDLERS, INSIGHTS_TOOLS } from "@/lib/ai/insightsTools";
import { getInsightSnapshot, insightScope, persistGeneratedInsights } from "@/lib/insightCatalog";
import { getLangSearchApiKey } from "@/lib/websearch/langsearch";
import type { InsightSnapshot } from "@/types/insight";

export class InsightsNotConfiguredError extends Error {}

/**
 * Same pipeline as POST /api/insights — generate suggestions, merge into the
 * saved catalog, return the snapshot. Shared so the chatbot can regenerate
 * insights without duplicating the route.
 */
export async function generateAndPersistInsights(projectId?: string): Promise<InsightSnapshot> {
  const config = getAIConfig();
  if (!config) {
    throw new InsightsNotConfiguredError("AI is not configured");
  }

  const scope = insightScope(projectId);
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
  const suggestions = await generateInsights(
    userMessage,
    config,
    callAssistantModelWithTools,
    tools,
    INSIGHTS_TOOL_HANDLERS,
  );
  return persistGeneratedInsights(scope, suggestions);
}
