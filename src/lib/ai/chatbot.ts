import type { ChatCompletionMessage, ToolCallFn, ToolDefinition } from "@/lib/ai/chatTypes";
import { CHATBOT_SYSTEM_PROMPT } from "@/lib/ai/chatbotPrompts";
import { redactMessagesForModel } from "@/lib/ai/chatbotRedact";
import { executeToolCall, type ToolHandler } from "@/lib/ai/toolLoop";
import type { AIConfig } from "@/lib/ai/types";

export type { ToolHandler } from "@/lib/ai/toolLoop";

const MAX_TOOL_ITERATIONS = 6;

/**
 * Runs one user turn of the chatbot to completion: sends the conversation to
 * the model, executes any tool calls it makes against workspace data,
 * feeds the results back, and repeats until the model answers with plain
 * text (or the iteration cap is hit). Returns only the NEW messages produced
 * this turn (assistant tool-call messages, tool results, final reply) — the
 * caller appends them to its own history and re-sends the full thing next turn.
 *
 * `callWithTools`/`tools`/`handlers` are injected so this loop is testable
 * with fake models and fake tools, no network or database required.
 */
export async function runChatbotTurn(
  history: ChatCompletionMessage[],
  config: AIConfig,
  callWithTools: ToolCallFn,
  tools: ToolDefinition[],
  handlers: Record<string, ToolHandler>,
  systemPrompt: string = CHATBOT_SYSTEM_PROMPT,
): Promise<ChatCompletionMessage[]> {
  // The model never sees generated credentials; the browser gets them untouched in newMessages.
  const messages: ChatCompletionMessage[] = [
    { role: "system", content: systemPrompt },
    ...redactMessagesForModel(history),
  ];
  const newMessages: ChatCompletionMessage[] = [];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const assistantMessage = await callWithTools(messages, tools, config);
    messages.push(assistantMessage);
    newMessages.push(assistantMessage);

    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return newMessages;
    }

    for (const call of assistantMessage.tool_calls) {
      const result = await executeToolCall(call, handlers);
      const toolMessage: ChatCompletionMessage = {
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      };
      messages.push(redactMessagesForModel([toolMessage])[0]);
      newMessages.push(toolMessage);
    }
  }

  newMessages.push({
    role: "assistant",
    content: "That's taking more steps than expected — could you rephrase, or try again?",
  });
  return newMessages;
}
