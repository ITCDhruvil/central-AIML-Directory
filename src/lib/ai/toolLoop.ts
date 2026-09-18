import type { ChatToolCall } from "@/lib/ai/chatTypes";

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

/** Shared by every tool-calling loop (chatbot.ts, insights.ts): parses one tool call's arguments, dispatches to its handler, and wraps any failure as a `{error}` tool result instead of throwing — a model requesting an unknown tool or sending malformed JSON args should never crash the turn. */
export async function executeToolCall(call: ChatToolCall, handlers: Record<string, ToolHandler>): Promise<unknown> {
  const handler = handlers[call.function.name];
  if (!handler) return { error: `Unknown tool: ${call.function.name}` };

  let args: Record<string, unknown>;
  try {
    const parsed = call.function.arguments ? JSON.parse(call.function.arguments) : {};
    args = typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return { error: "The tool call arguments were not valid JSON." };
  }

  try {
    return await handler(args);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Tool execution failed." };
  }
}
