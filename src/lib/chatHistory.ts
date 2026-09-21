import type { ChatCompletionMessage } from "@/lib/ai/chatTypes";

export const CHAT_HISTORY_KEY = "chatbot-conversations";
export const MAX_CONVERSATIONS = 50;

export interface ChatBubble {
  role: "user" | "assistant";
  content: string;
  related?: { href: string; label: string } | null;
  fallbackAction?: { href: string; label: string } | null;
  confirmation?: { yesText: string; noText: string } | null;
  feedback?: "up" | "down";
}

export interface ChatConversation {
  id: string;
  title: string;
  pinned: boolean;
  updatedAt: number;
  messages: ChatCompletionMessage[];
  bubbles: ChatBubble[];
}

export function createChatId(): string {
  return crypto.randomUUID();
}

export function titleFromPrompt(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New chat";
  return cleaned.length > 72 ? `${cleaned.slice(0, 69)}…` : cleaned;
}

export function sortConversations(items: ChatConversation[]): ChatConversation[] {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBubble(value: unknown): value is ChatBubble {
  if (!isRecord(value)) return false;
  if (!((value.role === "user" || value.role === "assistant") && typeof value.content === "string")) return false;
  if (value.feedback !== undefined && value.feedback !== "up" && value.feedback !== "down") return false;
  return true;
}

function isMessage(value: unknown): value is ChatCompletionMessage {
  if (!isRecord(value)) return false;
  return (
    (value.role === "system" || value.role === "user" || value.role === "assistant" || value.role === "tool") &&
    (value.content === null || typeof value.content === "string")
  );
}

function isConversation(value: unknown): value is ChatConversation {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.pinned === "boolean" &&
    typeof value.updatedAt === "number" &&
    Array.isArray(value.messages) &&
    value.messages.every(isMessage) &&
    Array.isArray(value.bubbles) &&
    value.bubbles.every(isBubble)
  );
}

export function parseConversations(raw: string | null): ChatConversation[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortConversations(parsed.filter(isConversation));
  } catch {
    return [];
  }
}

export function loadConversations(): ChatConversation[] {
  if (typeof window === "undefined") return [];
  return parseConversations(window.localStorage.getItem(CHAT_HISTORY_KEY));
}

export function saveConversations(items: ChatConversation[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(items));
}

export function upsertConversation(items: ChatConversation[], next: ChatConversation): ChatConversation[] {
  const merged = sortConversations([next, ...items.filter((item) => item.id !== next.id)]);
  if (merged.length <= MAX_CONVERSATIONS) return merged;
  const pinned = merged.filter((item) => item.pinned);
  const rest = merged.filter((item) => !item.pinned);
  return [...pinned, ...rest.slice(0, Math.max(0, MAX_CONVERSATIONS - pinned.length))];
}

export function togglePinned(items: ChatConversation[], id: string): ChatConversation[] {
  return sortConversations(items.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item)));
}

export function removeConversation(items: ChatConversation[], id: string): ChatConversation[] {
  return items.filter((item) => item.id !== id);
}

export function pinnedAndRecent(items: ChatConversation[]): { pinned: ChatConversation[]; recent: ChatConversation[] } {
  return {
    pinned: items.filter((item) => item.pinned),
    recent: items.filter((item) => !item.pinned),
  };
}

/** Slice API history so it ends just before the given 0-based user turn. */
export function cutBeforeUserTurn(messages: ChatCompletionMessage[], userTurnIndex: number): ChatCompletionMessage[] {
  let seen = 0;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role !== "user") continue;
    if (seen === userTurnIndex) return messages.slice(0, i);
    seen += 1;
  }
  return messages;
}
