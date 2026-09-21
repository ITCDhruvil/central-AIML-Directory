import type { ChatCompletionMessage } from "@/lib/ai/chatTypes";
import type { ThemePreference } from "@/lib/theme";

export interface ChatLink {
  href: string;
  label: string;
}

export interface ChatConfirmation {
  yesText: string;
  noText: string;
}

export interface ChatClientAction {
  type: "set_theme";
  theme: ThemePreference;
}

function parseToolJson(content: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(content);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function namedEntity(value: unknown): { id: string; name: string } | null {
  if (typeof value !== "object" || value === null) return null;
  const entity = value as Record<string, unknown>;
  const id = typeof entity.id === "string" ? entity.id : "";
  const name = typeof entity.name === "string" ? entity.name : "";
  if (!id || !name) return null;
  return { id, name };
}

function lastToolPayloads(messages: ChatCompletionMessage[]): Record<string, unknown>[] {
  const payloads: Record<string, unknown>[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "tool") continue;
    if (!message.content) break;
    const parsed = parseToolJson(message.content);
    if (parsed) payloads.push(parsed);
  }
  return payloads;
}

/** Most recently touched project, idea, or explicit related link from this turn's tool results. */
export function extractRelatedLink(messages: ChatCompletionMessage[]): ChatLink | null {
  for (const parsed of lastToolPayloads(messages)) {
    const related = parsed.related;
    if (typeof related === "object" && related !== null) {
      const link = related as Record<string, unknown>;
      if (typeof link.href === "string" && typeof link.name === "string") {
        return { href: link.href, label: link.name };
      }
    }
    const project = namedEntity(parsed.project);
    if (project) return { href: `/projects/${project.id}`, label: project.name };
    const idea = namedEntity(parsed.idea);
    if (idea) return { href: `/ideas/${idea.id}`, label: idea.name };
  }
  return null;
}

/**
 * Pulls a tool-suggested next step from this turn's LAST tool result only —
 * never an earlier one. Retries within a turn should not leave a stale button.
 */
export function extractFallbackAction(messages: ChatCompletionMessage[]): ChatLink | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "tool") continue;
    if (!message.content) return null;
    const parsed = parseToolJson(message.content);
    const action = parsed?.fallbackAction;
    if (action && typeof action === "object") {
      const link = action as Record<string, unknown>;
      if (typeof link.href === "string" && typeof link.label === "string") {
        return { href: link.href, label: link.label };
      }
    }
    return null;
  }
  return null;
}

/** Successful "open this page" affordance — same button as fallback, different prompt meaning. */
export function extractNavAction(messages: ChatCompletionMessage[]): ChatLink | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "tool") continue;
    if (!message.content) return null;
    const parsed = parseToolJson(message.content);
    const action = parsed?.navAction;
    if (action && typeof action === "object") {
      const link = action as Record<string, unknown>;
      if (typeof link.href === "string" && typeof link.label === "string") {
        return { href: link.href, label: link.label };
      }
    }
    return null;
  }
  return null;
}

export function extractConfirmation(messages: ChatCompletionMessage[]): ChatConfirmation | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "tool") continue;
    if (!message.content) return null;
    const parsed = parseToolJson(message.content);
    if (!parsed) return null;

    if (parsed.requiresConfirmation === true) {
      const project = namedEntity(parsed.project);
      const idea = namedEntity(parsed.idea);
      const name = idea?.name ?? project?.name ?? "it";
      if (parsed.action === "promote") {
        return { yesText: `Yes, promote ${name} to a project.`, noText: "No, cancel that." };
      }
      return { yesText: `Yes, delete ${name}.`, noText: "No, cancel that." };
    }
    if ("draft" in parsed) {
      return { yesText: "Yes, create it.", noText: "No, cancel that." };
    }
    return null;
  }
  return null;
}

export function extractClientAction(messages: ChatCompletionMessage[]): ChatClientAction | null {
  for (const parsed of lastToolPayloads(messages)) {
    const action = parsed.clientAction;
    if (action && typeof action === "object") {
      const body = action as Record<string, unknown>;
      if (body.type === "set_theme" && (body.theme === "light" || body.theme === "dark" || body.theme === "system")) {
        return { type: "set_theme", theme: body.theme };
      }
    }
  }
  return null;
}

/** Belt-and-suspenders for the system prompt's "don't also write the link yourself" instruction. */
export function stripDuplicateLink(content: string, href: string): string {
  const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return content
    .replace(new RegExp(`\\[([^\\]]*)\\]\\(${escaped}\\)`, "g"), "$1")
    .replace(new RegExp(escaped, "g"), "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
