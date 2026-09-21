"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUp, History, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { MarkdownView } from "@/components/MarkdownView";
import { ChatHistoryList } from "@/components/ChatHistoryList";
import { ChatBubbleActions } from "@/components/ChatBubbleActions";
import { useChatbot } from "@/components/ChatbotContext";
import type { ChatCompletionMessage } from "@/lib/ai/chatTypes";
import {
  extractClientAction,
  extractConfirmation,
  extractFallbackAction,
  extractNavAction,
  extractRelatedLink,
  stripDuplicateLink,
} from "@/lib/ai/chatbotUi";
import { applyTheme } from "@/lib/theme";
import {
  createChatId,
  cutBeforeUserTurn,
  loadConversations,
  removeConversation,
  saveConversations,
  titleFromPrompt,
  togglePinned,
  upsertConversation,
  type ChatBubble,
  type ChatConversation,
} from "@/lib/chatHistory";

const ICON_BTN =
  "flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-orange-50 hover:text-orange-600 dark:text-zinc-400 dark:hover:bg-orange-500/15 dark:hover:text-orange-400";

const MAX_INPUT_LENGTH = 2000;

const SUGGESTIONS = [
  "What's on the dashboard?",
  "What ideas do I have?",
  "Generate new insights",
  "Switch to dark mode",
];

function findFinalReply(messages: ChatCompletionMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === "assistant" && typeof message.content === "string" && message.content.trim()) {
      return message.content;
    }
  }
  return null;
}

/**
 * Global assistant drawer — mounted once in the root layout. Talks to /api/chat
 * and keeps conversation history in this browser (localStorage), including pin
 * and delete. Open/close is shared with the sidebar launch button.
 */
export function Chatbot() {
  const { open, setOpen } = useChatbot();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatCompletionMessage[]>([]);
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setConversations(loadConversations());
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [bubbles, loading]);

  useEffect(() => {
    if (!open || historyOpen) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, activeId, historyOpen]);

  function closeAssistant() {
    setHistoryOpen(false);
    setOpen(false);
  }

  function backToChat() {
    setHistoryOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (historyOpen) backToChat();
      else closeAssistant();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, historyOpen, setOpen]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function persist(updater: (items: ChatConversation[]) => ChatConversation[]) {
    setConversations((items) => {
      const next = updater(items);
      saveConversations(next);
      return next;
    });
  }

  function commitActive(id: string, messages: ChatCompletionMessage[], nextBubbles: ChatBubble[], title?: string) {
    persist((items) => {
      const existing = items.find((item) => item.id === id);
      return upsertConversation(items, {
        id,
        title: title ?? existing?.title ?? titleFromPrompt(nextBubbles[0]?.content ?? ""),
        pinned: existing?.pinned ?? false,
        updatedAt: Date.now(),
        messages,
        bubbles: nextBubbles,
      });
    });
  }

  function startNewChat() {
    setActiveId(null);
    setHistory([]);
    setBubbles([]);
    setError(null);
    setInput("");
    setHistoryOpen(false);
    inputRef.current?.focus();
  }

  function selectConversation(id: string) {
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) return;
    setActiveId(conversation.id);
    setHistory(conversation.messages);
    setBubbles(conversation.bubbles);
    setError(null);
    setHistoryOpen(false);
  }

  function pinConversation(id: string) {
    persist((items) => togglePinned(items, id));
  }

  function deleteConversation(id: string) {
    persist((items) => removeConversation(items, id));
    if (activeId === id) startNewChat();
  }

  async function send(
    text: string,
    base?: { history: ChatCompletionMessage[]; bubbles: ChatBubble[] },
  ) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const chatId = activeId ?? createChatId();
    if (!activeId) setActiveId(chatId);

    const sourceHistory = base?.history ?? history;
    const sourceBubbles = base?.bubbles ?? bubbles;
    const nextHistory: ChatCompletionMessage[] = [...sourceHistory, { role: "user", content: trimmed }];
    const nextBubbles: ChatBubble[] = [...sourceBubbles, { role: "user", content: trimmed }];
    const title = sourceBubbles.length === 0 ? titleFromPrompt(trimmed) : undefined;

    setHistory(nextHistory);
    setBubbles(nextBubbles);
    commitActive(chatId, nextHistory, nextBubbles, title);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextHistory }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Failed to reach the assistant");
        return;
      }

      const newMessages = body.messages as ChatCompletionMessage[];
      const mergedHistory = [...nextHistory, ...newMessages];
      setHistory(mergedHistory);

      const clientAction = extractClientAction(newMessages);
      if (clientAction?.type === "set_theme") {
        applyTheme(clientAction.theme);
      }

      const reply = findFinalReply(newMessages);
      if (reply) {
        const fallbackAction = extractFallbackAction(newMessages);
        const navAction = fallbackAction ? null : extractNavAction(newMessages);
        const button = fallbackAction ?? navAction;
        const withReply: ChatBubble[] = [
          ...nextBubbles,
          {
            role: "assistant",
            content: button ? stripDuplicateLink(reply, button.href) || "I couldn't complete that." : reply,
            related: extractRelatedLink(newMessages),
            fallbackAction: button,
            confirmation: extractConfirmation(newMessages),
          },
        ];
        setBubbles(withReply);
        commitActive(chatId, mergedHistory, withReply, title);
      } else {
        commitActive(chatId, mergedHistory, nextBubbles, title);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  async function copyBubble(index: number, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 1500);
    } catch {
      setError("Couldn't copy that");
    }
  }

  function regenerate(index: number) {
    const bubble = bubbles[index];
    if (!bubble || bubble.role !== "user" || loading) return;
    const userTurnIndex = bubbles.slice(0, index).filter((item) => item.role === "user").length;
    void send(bubble.content, {
      history: cutBeforeUserTurn(history, userTurnIndex),
      bubbles: bubbles.slice(0, index),
    });
  }

  function setFeedback(index: number, value: "up" | "down") {
    const nextBubbles = bubbles.map((bubble, i) => {
      if (i !== index) return bubble;
      return { ...bubble, feedback: bubble.feedback === value ? undefined : value };
    });
    setBubbles(nextBubbles);
    if (activeId) commitActive(activeId, history, nextBubbles);
  }

  const canSend = Boolean(input.trim()) && !loading;
  const activeTitle = conversations.find((item) => item.id === activeId)?.title ?? "New chat";

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close assistant"
          className="fixed inset-0 z-40 bg-zinc-950/25 dark:bg-black/40"
          onClick={closeAssistant}
        />
      )}

      <aside
        aria-hidden={!open}
        aria-label="Assistant"
        inert={!open || undefined}
        className={cn(
          "fixed inset-2 z-50 flex w-auto max-w-full overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04),0_12px_32px_rgba(24,24,27,0.06)] ring-1 ring-zinc-950/5 transition-transform duration-300 ease-out sm:inset-y-2.5 sm:right-2.5 sm:left-auto sm:w-[28rem] md:w-[32rem] dark:bg-zinc-900 dark:ring-white/10",
          open ? "translate-x-0" : "pointer-events-none translate-x-[calc(100%+0.75rem)]",
        )}
      >
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-0.5 px-4 pt-3.5 pb-2.5">
            <div className="min-w-0 flex-1 px-0.5">
              <p className="truncate font-sans text-[15px] font-semibold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50">{activeTitle}</p>
              <p className="truncate font-sans text-xs leading-tight text-zinc-500 dark:text-zinc-400">Projects, ideas, insights, and settings</p>
            </div>
            <button type="button" title="New chat" aria-label="New chat" onClick={startNewChat} className={ICON_BTN}>
              <Plus size={16} />
            </button>
            <button type="button" title="Chat history" aria-label="Chat history" onClick={() => setHistoryOpen(true)} className={ICON_BTN}>
              <History size={16} />
            </button>
            <button type="button" title="Close" aria-label="Close" onClick={closeAssistant} className={ICON_BTN}>
              <X size={16} />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {bubbles.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-2 text-center">
                <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                  Ask about projects, ideas, insights, the dashboard, or settings.
                </p>
                <div className="flex w-full max-w-sm flex-col gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => send(suggestion)}
                      className="rounded-full border border-zinc-200 px-3 py-2 text-left text-[13px] text-zinc-600 hover:border-orange-300 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-orange-500 dark:hover:text-orange-400"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {bubbles.map((bubble, i) => (
              <div key={`${bubble.role}-${i}`} className={cn("group flex flex-col", bubble.role === "user" ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                    bubble.role === "user"
                      ? "bg-orange-600 text-white"
                      : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
                  )}
                >
                  {bubble.role === "assistant" ? (
                    <div className="[&_ol]:my-1 [&_ol]:pl-4 [&_p]:my-0 [&_p+p]:mt-2 [&_ul]:my-1 [&_ul]:pl-4">
                      <MarkdownView content={bubble.content} />
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{bubble.content}</p>
                  )}
                  {bubble.related && (
                    <Link
                      href={bubble.related.href}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:underline dark:text-orange-400"
                    >
                      View {bubble.related.label} →
                    </Link>
                  )}
                  {bubble.fallbackAction && (
                    <Link
                      href={bubble.fallbackAction.href}
                      className="mt-2 inline-flex items-center gap-1 rounded-full bg-orange-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-orange-500"
                    >
                      {bubble.fallbackAction.label} →
                    </Link>
                  )}
                  {bubble.confirmation && i === bubbles.length - 1 && (
                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => send(bubble.confirmation!.yesText)}
                        disabled={loading}
                        className="rounded-full bg-orange-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => send(bubble.confirmation!.noText)}
                        disabled={loading}
                        className="rounded-full border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                <ChatBubbleActions
                  role={bubble.role}
                  copied={copiedIndex === i}
                  feedback={bubble.feedback}
                  disabled={loading}
                  onCopy={() => void copyBubble(i, bubble.content)}
                  onRegenerate={bubble.role === "user" ? () => regenerate(i) : undefined}
                  onFeedback={bubble.role === "assistant" ? (value) => setFeedback(i, value) : undefined}
                />
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <Loader2 size={14} className="animate-spin" />
                  Working...
                </div>
              </div>
            )}
          </div>

          {error && <p className="px-5 pb-2 text-xs text-red-600">{error}</p>}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="px-4 pb-4 pt-1"
          >
            <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 py-1 pl-4 pr-1 dark:border-zinc-700 dark:bg-zinc-900">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                maxLength={MAX_INPUT_LENGTH}
                rows={1}
                placeholder="Message the assistant..."
                disabled={loading}
                className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-sm leading-5 text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
              />
              <button
                type="submit"
                aria-label={loading ? "Sending" : "Send message"}
                disabled={!canSend}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
                  canSend
                    ? "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    : "bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600",
                )}
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <ArrowUp size={20} />}
              </button>
            </div>
          </form>
        </section>

        {historyOpen && (
          <section className="absolute inset-0 z-20 flex flex-col bg-[#F6F5FA] dark:bg-zinc-900">
            <header className="flex items-center gap-1 bg-white px-3 pt-3 pb-2 dark:bg-zinc-900">
              <button
                type="button"
                aria-label="Back to chat"
                onClick={backToChat}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium text-zinc-500 transition-colors hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-500/15 dark:hover:text-orange-400"
              >
                <ArrowLeft size={15} />
                Back
              </button>
              <p className="min-w-0 flex-1 truncate px-1 font-sans text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Chats</p>
              <button
                type="button"
                aria-label="Close assistant"
                onClick={closeAssistant}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium text-zinc-500 transition-colors hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-500/15 dark:hover:text-orange-400"
              >
                Close
                <X size={15} />
              </button>
            </header>
            <ChatHistoryList
              conversations={conversations}
              activeId={activeId}
              onSelect={selectConversation}
              onPin={pinConversation}
              onDelete={deleteConversation}
            />
          </section>
        )}
      </aside>
    </>
  );
}
