import type { ChatCompletionMessage } from "@/lib/ai/chatTypes";

// A tool result can carry `credentials` (a generated temporary password). It is for the signed-in admin's
// eyes only: the chat UI shows it in a card, but it must never be sent to the AI provider or saved in history.

export interface ChatCredentials {
  email: string;
  password: string;
  note?: string;
}

const REDACTED = "[shown to the admin only]";

/** Replaces a tool result's `credentials` with a placeholder. Anything else passes through unchanged. */
export function redactToolContent(content: string): string {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null || !("credentials" in parsed)) return content;
    return JSON.stringify({ ...(parsed as Record<string, unknown>), credentials: REDACTED });
  } catch {
    return content;
  }
}

/** Returns a copy of the conversation that is safe to send to the model or to persist. */
export function redactMessagesForModel(messages: ChatCompletionMessage[]): ChatCompletionMessage[] {
  return messages.map((message) =>
    message.role === "tool" && typeof message.content === "string"
      ? { ...message, content: redactToolContent(message.content) }
      : message,
  );
}

/** The credentials a tool in this turn produced, if any, so the UI can show them to the admin. */
export function extractCredentials(messages: ChatCompletionMessage[]): ChatCredentials | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "tool" || typeof message.content !== "string") continue;
    try {
      const parsed = JSON.parse(message.content) as { credentials?: unknown };
      const c = parsed.credentials;
      if (typeof c === "object" && c !== null) {
        const { email, password, note } = c as Record<string, unknown>;
        if (typeof email === "string" && typeof password === "string") {
          return { email, password, ...(typeof note === "string" ? { note } : {}) };
        }
      }
    } catch {
      // not JSON — skip
    }
  }
  return null;
}
