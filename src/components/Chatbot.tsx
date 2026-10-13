"use client";

import { useAuthUser } from "@/components/AuthProvider";
import { ASSISTANT_NAME } from "@/lib/assistantName";
import {
  ABSOLUTE_MAX_CHAT_WIDTH,
  DEFAULT_CHAT_WIDTH,
  MIN_CHAT_WIDTH,
  chatWidthKey,
  clampChatWidth,
  parseStoredChatWidth,
  widthFromPointer,
} from "@/lib/chatWidth";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowUp,
  ArrowUpRight,
  Check,
  History,
  Loader2,
  MessageSquare,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { MarkdownView } from "@/components/MarkdownView";
import { ChatCredentialsCard } from "@/components/ChatCredentialsCard";
import { ChatThinking } from "@/components/ChatThinking";
import { ChatWelcome } from "@/components/ChatWelcome";
import { motion } from "motion/react";
import { FluidTabs } from "@/components/ui/FluidTabs";
import { ChatHistoryList } from "@/components/ChatHistoryList";
import { extractCredentials } from "@/lib/ai/chatbotRedact";
import { ChatBubbleActions } from "@/components/ChatBubbleActions";
import { useChatbot } from "@/components/ChatbotContext";
import type { ChatCompletionMessage } from "@/lib/ai/chatTypes";
import {
  extractClientAction,
  extractConfirmation,
  extractFallbackAction,
  extractFollowUps,
  extractNavAction,
  fixPlaceholderLinks,
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

const MAX_INPUT_LENGTH = 2000;

// Buttons that sit under a reply: one filled (the main thing to do) and one outlined.
const ACTION_PRIMARY =
  "inline-flex h-8 items-center gap-1.5 rounded-lg bg-orange-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-orange-700";
const ACTION_SECONDARY =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-orange-500/60 dark:hover:bg-orange-500/10 dark:hover:text-orange-300";

function findFinalReply(messages: ChatCompletionMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (
      message.role === "assistant" &&
      typeof message.content === "string" &&
      message.content.trim()
    ) {
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

  // Panel width: drag the left edge to widen it. The choice is remembered per person (in this browser).
  const user = useAuthUser();
  const [width, setWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [resizing, setResizing] = useState(false);
  const widthRef = useRef(DEFAULT_CHAT_WIDTH);

  useEffect(() => {
    if (!user) return;
    const frame = window.requestAnimationFrame(() => {
      let stored: number | null = null;
      try {
        stored = parseStoredChatWidth(
          window.localStorage.getItem(chatWidthKey(user.id)),
          window.innerWidth,
        );
      } catch {
        // storage unavailable: the default width is fine
      }
      const next = stored ?? DEFAULT_CHAT_WIDTH;
      widthRef.current = next;
      setWidth(next);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [user]);

  function applyWidth(px: number) {
    const next = clampChatWidth(px, window.innerWidth);
    widthRef.current = next;
    setWidth(next);
  }

  function saveWidth(value: number | null) {
    if (!user) return;
    try {
      if (value === null) window.localStorage.removeItem(chatWidthKey(user.id));
      else window.localStorage.setItem(chatWidthKey(user.id), String(value));
    } catch {
      // storage unavailable: it just won't be remembered
    }
  }

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    try {
      // Keeps the drag going when the pointer leaves the thin handle. If the browser refuses, dragging still works
      // while the pointer stays over the handle.
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // not capturable (e.g. a synthetic pointer)
    }
    setResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function moveResize(event: React.PointerEvent<HTMLDivElement>) {
    if (!resizing) return;
    applyWidth(widthFromPointer(event.clientX, window.innerWidth));
  }

  function endResize(event: React.PointerEvent<HTMLDivElement>) {
    if (!resizing) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    saveWidth(widthRef.current);
  }

  function resizeByKey(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 96 : 24;
    if (event.key === "ArrowLeft") applyWidth(widthRef.current + step);
    else if (event.key === "ArrowRight") applyWidth(widthRef.current - step);
    else if (event.key === "Home") applyWidth(DEFAULT_CHAT_WIDTH);
    else return;
    event.preventDefault();
    saveWidth(
      widthRef.current === DEFAULT_CHAT_WIDTH ? null : widthRef.current,
    );
  }

  // Hydrate saved conversations from localStorage after mount (it doesn't exist during SSR).
  useEffect(() => {
    const frame = window.requestAnimationFrame(() =>
      setConversations(loadConversations()),
    );
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
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

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (historyOpen) {
        setHistoryOpen(false);
      } else {
        setHistoryOpen(false);
        setOpen(false);
      }
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

  function commitActive(
    id: string,
    messages: ChatCompletionMessage[],
    nextBubbles: ChatBubble[],
    title?: string,
  ) {
    persist((items) => {
      const existing = items.find((item) => item.id === id);
      return upsertConversation(items, {
        id,
        title:
          title ??
          existing?.title ??
          titleFromPrompt(nextBubbles[0]?.content ?? ""),
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
    const nextHistory: ChatCompletionMessage[] = [
      ...sourceHistory,
      { role: "user", content: trimmed },
    ];
    const nextBubbles: ChatBubble[] = [
      ...sourceBubbles,
      { role: "user", content: trimmed },
    ];
    const title =
      sourceBubbles.length === 0 ? titleFromPrompt(trimmed) : undefined;

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
        setError(
          typeof body.error === "string"
            ? body.error
            : "Failed to reach the assistant",
        );
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
        const { text: replyText, followUps } = extractFollowUps(reply);
        const fallbackAction = extractFallbackAction(newMessages);
        const navAction = fallbackAction ? null : extractNavAction(newMessages);
        const button = fallbackAction ?? navAction;
        const withReply: ChatBubble[] = [
          ...nextBubbles,
          {
            role: "assistant",
            content: button
              ? stripDuplicateLink(replyText, button.href) ||
                "I couldn't complete that."
              : replyText,
            followUps,
            related: extractRelatedLink(newMessages),
            fallbackAction: button,
            confirmation: extractConfirmation(newMessages),
            credentials: extractCredentials(newMessages),
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
      window.setTimeout(
        () => setCopiedIndex((current) => (current === index ? null : current)),
        1500,
      );
    } catch {
      setError("Couldn't copy that");
    }
  }

  function regenerate(index: number) {
    const bubble = bubbles[index];
    if (!bubble || bubble.role !== "user" || loading) return;
    const userTurnIndex = bubbles
      .slice(0, index)
      .filter((item) => item.role === "user").length;
    void send(bubble.content, {
      history: cutBeforeUserTurn(history, userTurnIndex),
      bubbles: bubbles.slice(0, index),
    });
  }

  function setFeedback(index: number, value: "up" | "down") {
    const nextBubbles = bubbles.map((bubble, i) => {
      if (i !== index) return bubble;
      return {
        ...bubble,
        feedback: bubble.feedback === value ? undefined : value,
      };
    });
    setBubbles(nextBubbles);
    if (activeId) commitActive(activeId, history, nextBubbles);
  }

  const canSend = Boolean(input.trim()) && !loading;

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
        aria-label={ASSISTANT_NAME}
        inert={!open || undefined}
        style={{ "--chat-w": `${width}px` } as CSSProperties}
        className={cn(
          "fixed inset-2 z-50 flex w-auto max-w-full overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04),0_12px_32px_rgba(24,24,27,0.06)] ring-1 ring-zinc-950/5 transition-transform duration-300 ease-out sm:inset-y-2.5 sm:right-2.5 sm:left-auto sm:w-[var(--chat-w)] dark:bg-zinc-900 dark:ring-white/10",
          open
            ? "translate-x-0"
            : "pointer-events-none translate-x-[calc(100%+0.75rem)]",
        )}
      >
        {/* Drag the left edge to widen the assistant; double-click or press Home to reset. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize assistant"
          aria-valuenow={width}
          aria-valuemin={MIN_CHAT_WIDTH}
          aria-valuemax={ABSOLUTE_MAX_CHAT_WIDTH}
          tabIndex={0}
          title="Drag to resize · double-click to reset"
          onPointerDown={startResize}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onDoubleClick={() => {
            applyWidth(DEFAULT_CHAT_WIDTH);
            saveWidth(null);
          }}
          onKeyDown={resizeByKey}
          className="group absolute inset-y-0 left-0 z-30 hidden w-2.5 cursor-col-resize touch-none items-center justify-center outline-none sm:flex"
        >
          <span
            className={cn(
              "h-12 w-1 rounded-full bg-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-zinc-600",
              resizing && "bg-orange-500 opacity-100 dark:bg-orange-500",
            )}
          />
        </div>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-2 px-3 pb-2 pt-3">
            <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
              <div className="w-max">
                <FluidTabs
                  size="sm"
                  layoutId="chat-tabs-pill"
                  active={historyOpen ? "history" : "chat"}
                  onChange={(id) => {
                    if (id === "new") startNewChat();
                    else setHistoryOpen(id === "history");
                  }}
                  tabs={[
                    {
                      id: "chat",
                      label: "Chat",
                      icon: <MessageSquare size={15} />,
                    },
                    {
                      id: "history",
                      label: "History",
                      icon: <History size={15} />,
                    },
                    { id: "new", label: "New", icon: <Plus size={15} /> },
                  ]}
                />
              </div>
            </div>
            {/* Same pill background as the tab bar; the hover brightens it like the active tab and springs slightly. */}
            <motion.button
              type="button"
              title="Close"
              aria-label="Close"
              onClick={closeAssistant}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.6px] border-[#f5f1ebf4] bg-[#F5F1EB] text-[#585652] transition-colors hover:bg-gradient-to-b hover:from-[#fefefe] hover:to-gray-50/80 hover:text-[#292926] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:from-neutral-700 dark:hover:to-neutral-800/90 dark:hover:text-white"
            >
              <X size={16} />
            </motion.button>
          </header>

          {historyOpen ? (
            <ChatHistoryList
              conversations={conversations}
              activeId={activeId}
              onSelect={selectConversation}
              onPin={pinConversation}
              onDelete={deleteConversation}
            />
          ) : (
            <>
              <div
                ref={listRef}
                className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
              >
                {bubbles.length === 0 && (
                  <ChatWelcome onPick={(prompt) => send(prompt)} />
                )}

                {bubbles.map((bubble, i) => (
                  <div
                    key={`${bubble.role}-${i}`}
                    className={cn(
                      "group flex flex-col",
                      bubble.role === "user" ? "items-end" : "items-stretch",
                    )}
                  >
                    {bubble.role === "user" ? (
                      <div className="max-w-[85%] self-end rounded-2xl bg-orange-600 px-3.5 py-2 text-sm text-white">
                        <p className="whitespace-pre-wrap">{bubble.content}</p>
                      </div>
                    ) : (
                      // Replies run the full width with no bubble, so tables and lists have room.
                      <div className="w-full min-w-0 text-sm text-zinc-800 dark:text-zinc-100">
                        <div className="[&_ol]:my-1 [&_ol]:pl-4 [&_p]:my-0 [&_p+p]:mt-2 [&_ul]:my-1 [&_ul]:pl-4">
                          <MarkdownView
                            content={fixPlaceholderLinks(bubble.content)}
                            variant="chat"
                          />
                        </div>

                        {(bubble.related ||
                          bubble.fallbackAction ||
                          (bubble.confirmation &&
                            i === bubbles.length - 1)) && (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {bubble.fallbackAction && (
                              <Link
                                href={bubble.fallbackAction.href}
                                className={ACTION_PRIMARY}
                              >
                                {bubble.fallbackAction.label}
                                <ArrowUpRight size={14} />
                              </Link>
                            )}
                            {bubble.related && (
                              <Link
                                href={bubble.related.href}
                                className={ACTION_SECONDARY}
                              >
                                View {bubble.related.label}
                                <ArrowUpRight size={14} />
                              </Link>
                            )}
                            {bubble.confirmation &&
                              i === bubbles.length - 1 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      send(bubble.confirmation!.yesText)
                                    }
                                    disabled={loading}
                                    className={cn(
                                      ACTION_PRIMARY,
                                      "disabled:cursor-not-allowed disabled:opacity-40",
                                    )}
                                  >
                                    <Check size={14} />
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      send(bubble.confirmation!.noText)
                                    }
                                    disabled={loading}
                                    className={cn(
                                      ACTION_SECONDARY,
                                      "disabled:cursor-not-allowed disabled:opacity-40",
                                    )}
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                          </div>
                        )}

                        {bubble.credentials && (
                          <ChatCredentialsCard
                            credentials={bubble.credentials}
                          />
                        )}

                        {/* Suggested next steps: only under the latest reply, and not while a confirmation is waiting. */}
                        {i === bubbles.length - 1 &&
                          !loading &&
                          !bubble.confirmation &&
                          bubble.followUps &&
                          bubble.followUps.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {bubble.followUps.map((suggestion) => (
                                <button
                                  key={suggestion}
                                  type="button"
                                  onClick={() => send(suggestion)}
                                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-orange-500/60 dark:hover:bg-orange-500/10 dark:hover:text-orange-300"
                                >
                                  {suggestion}
                                </button>
                              ))}
                            </div>
                          )}
                      </div>
                    )}
                    <ChatBubbleActions
                      role={bubble.role}
                      copied={copiedIndex === i}
                      feedback={bubble.feedback}
                      disabled={loading}
                      onCopy={() => void copyBubble(i, bubble.content)}
                      onRegenerate={
                        bubble.role === "user" ? () => regenerate(i) : undefined
                      }
                      onFeedback={
                        bubble.role === "assistant"
                          ? (value) => setFeedback(i, value)
                          : undefined
                      }
                    />
                  </div>
                ))}

                {loading && <ChatThinking />}
              </div>

              {error && (
                <p className="px-5 pb-2 text-xs text-red-600">{error}</p>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="px-3 pb-3 pt-1"
              >
                <div className="flex items-end gap-2 rounded-[1.375rem] border border-zinc-200 bg-white py-1 pl-4 pr-1 shadow-sm transition focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-950">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send(input);
                      }
                    }}
                    maxLength={MAX_INPUT_LENGTH}
                    rows={1}
                    placeholder={`Ask ${ASSISTANT_NAME}…`}
                    disabled={loading}
                    className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm leading-5 text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
                  />
                  <button
                    type="submit"
                    aria-label={loading ? "Sending" : "Send message"}
                    disabled={!canSend}
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
                      canSend
                        ? "bg-orange-600 text-white hover:bg-orange-700"
                        : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600",
                    )}
                  >
                    {loading ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <ArrowUp size={17} />
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </aside>
    </>
  );
}
