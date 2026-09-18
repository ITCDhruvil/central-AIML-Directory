import "server-only";
import { AIProviderError, type AIConfig } from "@/lib/ai/types";
import type { ChatCompletionMessage, ToolDefinition } from "@/lib/ai/chatTypes";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Minimal hand-rolled OpenAI-compatible chat-completions call — no SDK, no
 * agent framework. Deliberately the only place in the codebase that talks to
 * the AI provider network endpoint. Model configuration comes from
 * `getAIConfig()` (src/lib/ai/config.ts), not from anything here.
 */
export async function callAssistantModel(systemPrompt: string, userMessage: string, config: AIConfig): Promise<string> {
  let response: Response;
  try {
    response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.maxOutputTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });
  } catch {
    throw new AIProviderError("Failed to reach the AI provider");
  }

  if (!response.ok) {
    throw new AIProviderError(`AI provider request failed with status ${response.status}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new AIProviderError("AI provider returned an unexpected response shape");
  }

  return content;
}

/**
 * Same provider/endpoint as callAssistantModel, but carries a full message
 * history and tool schemas instead of one fixed system+user pair, and returns
 * the raw assistant message (which may be a tool call, not text) instead of
 * forcing JSON content. Used only by the chatbot's tool-calling loop.
 */
export async function callAssistantModelWithTools(
  messages: ChatCompletionMessage[],
  tools: ToolDefinition[],
  config: AIConfig,
): Promise<ChatCompletionMessage> {
  let response: Response;
  try {
    response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.maxOutputTokens,
        messages,
        ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
      }),
    });
  } catch {
    throw new AIProviderError("Failed to reach the AI provider");
  }

  if (!response.ok) {
    throw new AIProviderError(`AI provider request failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: ChatCompletionMessage }>;
  };
  const message = data.choices?.[0]?.message;
  if (!message || (message.content === undefined && !message.tool_calls)) {
    throw new AIProviderError("AI provider returned an unexpected response shape");
  }

  return { role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls };
}
