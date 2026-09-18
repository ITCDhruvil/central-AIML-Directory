"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, CornerDownLeft, Loader2, MessageCircleMore, RotateCcw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { MarkdownView } from "@/components/MarkdownView";
import type { ChatCompletionMessage } from "@/lib/ai/chatTypes";

interface Bubble {
  role: "user" | "assistant";
  content: string;
  relatedProject?: { id: string; name: string } | null;
  fallbackAction?: { href: string; label: string } | null;
  confirmation?: { yesText: string; noText: string } | null;
}

const MAX_INPUT_LENGTH = 2000;

const SUGGESTIONS = [
  "What projects do I have?",
  "Create a project from a GitHub repo link",
  "Move a project to On Hold",
];

/** Pulls the most recently touched project (created/updated/found) out of this turn's tool results, so the reply can link straight to it. */
function extractRelatedProject(messages: ChatCompletionMessage[]): { id: string; name: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "tool" || !message.content) continue;
    try {
      const parsed = JSON.parse(message.content) as { project?: { id?: unknown; name?: unknown } };
      const project = parsed.project;
      if (project && typeof project.id === "string" && typeof project.name === "string") {
        return { id: project.id, name: project.name };
      }
    } catch {
      // Tool content isn't always JSON we care about — ignore and keep scanning.
    }
  }
  return null;
}

/**
 * Pulls a tool-suggested next step (e.g. "open the New Project form") out of
 * this turn's LAST tool result only — never an earlier one. The model can
 * retry within a turn (e.g. a failed create_project missing a field,
 * corrected and resubmitted), and only the outcome of the final attempt
 * should ever reach the UI; a fallback button from an attempt that was
 * later fixed would be stale and wrong.
 */
function extractFallbackAction(messages: ChatCompletionMessage[]): { href: string; label: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "tool") continue;
    if (!message.content) return null;
    try {
      const parsed = JSON.parse(message.content) as { fallbackAction?: { href?: unknown; label?: unknown } };
      const action = parsed.fallbackAction;
      if (action && typeof action.href === "string" && typeof action.label === "string") {
        return { href: action.href, label: action.label };
      }
    } catch {
      // Not JSON we care about.
    }
    return null;
  }
  return null;
}

/**
 * Detects when the most recent tool call left something pending the user
 * needs to explicitly approve — a delete awaiting confirmation, or a GitHub
 * draft awaiting a "go ahead and create it". Only the LAST tool message in
 * the turn counts, since that's what the model's reply is actually about.
 */
function extractConfirmation(messages: ChatCompletionMessage[]): { yesText: string; noText: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "tool") continue;
    if (!message.content) return null;
    try {
      const parsed = JSON.parse(message.content) as { requiresConfirmation?: unknown; project?: { name?: unknown }; draft?: unknown };
      if (parsed.requiresConfirmation === true) {
        const name = parsed.project && typeof parsed.project.name === "string" ? parsed.project.name : "it";
        return { yesText: `Yes, delete ${name}.`, noText: "No, cancel that." };
      }
      if ("draft" in parsed) {
        return { yesText: "Yes, create it.", noText: "No, cancel that." };
      }
    } catch {
      // Not JSON we care about.
    }
    return null;
  }
  return null;
}

/** Belt-and-suspenders for the system prompt's "don't also write the link yourself" instruction — models don't always comply, so strip any Markdown link/bare URL pointing at the button's own href before rendering. */
function stripDuplicateLink(content: string, href: string): string {
  const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return content
    .replace(new RegExp(`\\[([^\\]]*)\\]\\(${escaped}\\)`, "g"), "$1")
    .replace(new RegExp(escaped, "g"), "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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
 * Floating global assistant — mounted once in the root layout, available on
 * every page. Talks to /api/chat, which runs the tool-calling loop against
 * real project data (list/create/update/delete). Conversation history lives
 * only in this component's state; nothing is persisted server-side.
 */
export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ChatCompletionMessage[]>([]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [bubbles, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextHistory: ChatCompletionMessage[] = [...history, { role: "user", content: trimmed }];
    setHistory(nextHistory);
    setBubbles((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
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
      setHistory((prev) => [...prev, ...newMessages]);

      const reply = findFinalReply(newMessages);
      if (reply) {
        const fallbackAction = extractFallbackAction(newMessages);
        setBubbles((prev) => [
          ...prev,
          {
            role: "assistant",
            content: fallbackAction ? stripDuplicateLink(reply, fallbackAction.href) || "I couldn't complete that." : reply,
            relatedProject: extractRelatedProject(newMessages),
            fallbackAction,
            confirmation: extractConfirmation(newMessages),
          },
        ]);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setHistory([]);
    setBubbles([]);
    setError(null);
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-5 z-50 flex h-[34rem] w-[23rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-600 text-white">
                <Sparkles size={14} />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Dashboard Assistant</p>
                <p className="text-xs text-zinc-400">Create, update, and find projects</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="New chat"
                onClick={reset}
                className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                title="Close"
                onClick={() => setOpen(false)}
                className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {bubbles.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-2 text-center">
                <Bot size={28} className="text-zinc-300 dark:text-zinc-700" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Ask me to create, update, find, or clean up projects — in plain English.
                </p>
                <div className="flex w-full flex-col gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:border-orange-300 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-orange-500 dark:hover:text-orange-400"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {bubbles.map((b, i) => (
              <div key={i} className={cn("flex", b.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    b.role === "user" ? "bg-orange-600 text-white" : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
                  )}
                >
                  {b.role === "assistant" ? (
                    <div className="[&_ol]:my-1 [&_ol]:pl-4 [&_p]:my-0 [&_p+p]:mt-2 [&_ul]:my-1 [&_ul]:pl-4">
                      <MarkdownView content={b.content} />
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{b.content}</p>
                  )}
                  {b.relatedProject && (
                    <Link
                      href={`/projects/${b.relatedProject.id}`}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:underline dark:text-orange-400"
                    >
                      View {b.relatedProject.name} →
                    </Link>
                  )}
                  {b.fallbackAction && (
                    <Link
                      href={b.fallbackAction.href}
                      className="mt-2 inline-flex items-center gap-1 rounded-md bg-orange-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-orange-500"
                    >
                      {b.fallbackAction.label} →
                    </Link>
                  )}
                  {b.confirmation && i === bubbles.length - 1 && (
                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => send(b.confirmation!.yesText)}
                        disabled={loading}
                        className="rounded-md bg-orange-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => send(b.confirmation!.noText)}
                        disabled={loading}
                        className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
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

          {error && <p className="border-t border-zinc-100 px-4 py-2 text-xs text-red-600 dark:border-zinc-800">{error}</p>}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
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
                className="field max-h-24 w-full resize-none py-2 pr-10"
              />
              {(loading || input.trim()) && (
                <button
                  type="submit"
                  aria-label={loading ? "Sending" : "Send message"}
                  title="Press Enter to send"
                  disabled={loading || !input.trim()}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 hover:text-orange-600 disabled:opacity-40 dark:hover:text-orange-400"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <CornerDownLeft size={16} />}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-orange-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-orange-500"
      >
        {open ? <X size={20} /> : <MessageCircleMore size={20} />}
      </button>
    </>
  );
}
