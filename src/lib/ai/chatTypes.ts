/** OpenAI chat-completions message shape, extended with the tool-call fields the chatbot needs. */
export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** Calls the model with a running conversation + tool schemas, returning the assistant's next message (which may itself be a tool call). Injected so the orchestration loop in chatbot.ts is testable without network access. */
export type ToolCallFn = (
  messages: ChatCompletionMessage[],
  tools: ToolDefinition[],
  config: import("@/lib/ai/types").AIConfig,
) => Promise<ChatCompletionMessage>;
