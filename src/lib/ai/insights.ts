import type { ChatCompletionMessage, ToolCallFn, ToolDefinition } from "@/lib/ai/chatTypes";
import { INSIGHTS_SYSTEM_PROMPT } from "@/lib/ai/insightsPrompts";
import { parseInsightsResponse, type Suggestion } from "@/lib/ai/insightsValidator";
import { executeToolCall, type ToolHandler } from "@/lib/ai/toolLoop";
import type { AIConfig } from "@/lib/ai/types";

export class InsightsResponseError extends Error {}

const MAX_TOOL_ITERATIONS = 6;

/**
 * Runs the insights tool-calling loop to completion: the model can call
 * web_search as many times as it wants (up to the iteration cap), then must
 * answer with a JSON array of suggestions. Same shape as chatbot.ts's loop,
 * but ends in a parsed, validated array instead of a chat reply — this isn't
 * a conversation, it's a single structured-output job.
 */
export async function generateInsights(
  userMessage: string,
  config: AIConfig,
  callWithTools: ToolCallFn,
  tools: ToolDefinition[],
  handlers: Record<string, ToolHandler>,
): Promise<Suggestion[]> {
  const messages: ChatCompletionMessage[] = [
    { role: "system", content: INSIGHTS_SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const assistantMessage = await callWithTools(messages, tools, config);
    messages.push(assistantMessage);

    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      const suggestions = parseInsightsResponse(assistantMessage.content ?? "");
      if (!suggestions) {
        throw new InsightsResponseError("The AI returned a response that could not be understood");
      }
      return suggestions;
    }

    for (const call of assistantMessage.tool_calls) {
      const result = await executeToolCall(call, handlers);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  throw new InsightsResponseError("Ran out of steps searching before producing suggestions");
}
