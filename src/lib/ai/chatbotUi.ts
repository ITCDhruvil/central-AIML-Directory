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
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
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

function lastToolPayloads(
  messages: ChatCompletionMessage[],
): Record<string, unknown>[] {
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
export function extractRelatedLink(
  messages: ChatCompletionMessage[],
): ChatLink | null {
  for (const parsed of lastToolPayloads(messages)) {
    const related = parsed.related;
    if (typeof related === "object" && related !== null) {
      const link = related as Record<string, unknown>;
      if (typeof link.href === "string" && typeof link.name === "string") {
        return { href: link.href, label: link.name };
      }
    }
    const project = namedEntity(parsed.project);
    if (project)
      return { href: `/projects/${project.id}`, label: project.name };
    const idea = namedEntity(parsed.idea);
    if (idea) return { href: `/ideas/${idea.id}`, label: idea.name };
  }
  return null;
}

/**
 * Pulls a tool-suggested next step from this turn's LAST tool result only —
 * never an earlier one. Retries within a turn should not leave a stale button.
 */
export function extractFallbackAction(
  messages: ChatCompletionMessage[],
): ChatLink | null {
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
export function extractNavAction(
  messages: ChatCompletionMessage[],
): ChatLink | null {
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

export function extractConfirmation(
  messages: ChatCompletionMessage[],
): ChatConfirmation | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "tool") continue;
    if (!message.content) return null;
    const parsed = parseToolJson(message.content);
    if (!parsed) return null;

    if (parsed.requiresConfirmation === true) {
      const project = namedEntity(parsed.project);
      const idea = namedEntity(parsed.idea);
      const person = namedEntity(parsed.user);
      const name = idea?.name ?? project?.name ?? person?.name ?? "it";
      if (parsed.action === "reset_password") {
        return {
          yesText: `Yes, reset ${name}'s password.`,
          noText: "No, cancel that.",
        };
      }
      if (parsed.action === "delete_user") {
        return {
          yesText: `Yes, delete user ${name}.`,
          noText: "No, cancel that.",
        };
      }
      if (parsed.action === "role_permissions") {
        const role =
          typeof parsed.role === "string"
            ? parsed.role.toLowerCase()
            : "that role";
        return {
          yesText: `Yes, update ${role} permissions.`,
          noText: "No, cancel that.",
        };
      }
      if (parsed.action === "promote") {
        return {
          yesText: `Yes, promote ${name} to a project.`,
          noText: "No, cancel that.",
        };
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

export function extractClientAction(
  messages: ChatCompletionMessage[],
): ChatClientAction | null {
  for (const parsed of lastToolPayloads(messages)) {
    const action = parsed.clientAction;
    if (action && typeof action === "object") {
      const body = action as Record<string, unknown>;
      if (
        body.type === "set_theme" &&
        (body.theme === "light" ||
          body.theme === "dark" ||
          body.theme === "system")
      ) {
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

const tidyOption = (part: string) =>
  part
    .trim()
    // Bullets, quotes and a stray "|" at either end (from "a | b |" or bullets that end in a pipe) are not part of the text.
    .replace(/^[-*•|"'`\s]+|["'`.!|\s]+$/g, "")
    .trim();
const usableOptions = (parts: string[]) =>
  parts
    .map(tidyOption)
    .filter((p) => p.length > 0 && p.length <= 60)
    .slice(0, 3);

/**
 * Suggested next steps the model adds at the end of a reply. They become one-click chips under it and are removed from
 * the text. Two shapes are understood:
 *   Next: show active ideas | open the dashboard
 *   Next:            (header on its own line, then bullet lines)
 *   - show active ideas
 *   - open the dashboard
 * At most three are kept; anything over-long is dropped.
 */
export function extractFollowUps(reply: string): {
  text: string;
  followUps: string[];
} {
  const lines = reply.replace(/\s+$/, "").split("\n");
  const unchanged = { text: reply, followUps: [] as string[] };
  const finish = (headerIndex: number, followUps: string[]) => {
    const text = lines.slice(0, headerIndex).join("\n").replace(/\s+$/, "");
    // A reply that is only suggestions has nothing to attach them to: leave it as written.
    return followUps.length === 0 || text.trim() === ""
      ? unchanged
      : { text, followUps };
  };

  // One line: "Next: a | b | c"
  const last = lines[lines.length - 1] ?? "";
  const inline =
    /^\s*(?:\*\*)?next(?:\s+steps?)?(?:\*\*)?\s*:\s*(?:\*\*)?\s*(\S.*)$/i.exec(
      last,
    );
  if (inline)
    return finish(lines.length - 1, usableOptions(inline[1].split("|")));

  // A header line, then bullets
  const bullets: string[] = [];
  let i = lines.length - 1;
  for (; i >= 0; i--) {
    const bullet = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/.exec(lines[i]);
    if (!bullet) break;
    bullets.unshift(bullet[1]);
  }
  if (
    bullets.length > 0 &&
    i >= 0 &&
    /^\s*(?:\*\*)?next(?:\s+steps?)?\s*:?(?:\*\*)?\s*:?\s*$/i.test(lines[i])
  ) {
    return finish(i, usableOptions(bullets));
  }
  return unchanged;
}

/**
 * Models sometimes invent a domain for in-app links ("https://your-link.com/ideas/abc"). A link to a page in this app
 * must be a path like "/ideas/abc", so placeholder and localhost domains are stripped back to the path.
 */
export function fixPlaceholderLinks(markdown: string): string {
  return markdown.replace(
    /\]\(https?:\/\/(?:www\.)?(?:your-?link\.com|your-?domain\.com|your-?company\.com|your-?app\.com|example\.com|localhost(?::\d+)?)(\/[^)\s]*)\)/gi,
    "]($1)",
  );
}
