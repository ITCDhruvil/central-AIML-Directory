"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Check, Copy, FileText, Rocket, RotateCcw, Sparkles, Trash2, Wrench, BookOpen } from "lucide-react";
import { MarkdownView } from "@/components/MarkdownView";
import { cn } from "@/lib/cn";

interface Citation {
  documentId: string;
  title: string;
  category: string;
}

interface AssistantAnswer {
  answer: string;
  citations: Citation[];
}

type Message =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; text: string; citations: Citation[] };

const SUGGESTIONS = [
  { icon: BookOpen, label: "What is this project about?", hint: "A quick summary" },
  { icon: Rocket, label: "How do I set this project up locally?", hint: "Steps to run it" },
  { icon: Wrench, label: "What technologies does this project use?", hint: "The tech stack" },
];

const MAX_QUESTION_LENGTH = 500;

function AssistantAvatar() {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400">
      <Sparkles size={14} />
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard can be blocked (permissions, insecure context); nothing useful to show.
        }
      }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Thinking() {
  return (
    <div className="flex items-start gap-2.5" aria-live="polite">
      <AssistantAvatar />
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
        <span className="sr-only">Thinking</span>
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-bounce rounded-full bg-zinc-400"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ProjectAssistant({ projectId }: { projectId: string }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; retry: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep the newest message (or the thinking dots) in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, error]);

  // The box grows with what is typed, up to about four lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [question]);

  async function ask(raw: string) {
    const text = raw.trim();
    if (!text || loading) return;

    // The recent conversation goes along so follow-ups ("and how do I run it?") make sense; the server trims it.
    const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.text }));
    setMessages((prev) => [...prev, { id: nextId.current++, role: "user", text }]);
    setQuestion("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, history }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ message: body.error ?? "Failed to answer the question", retry: text });
        return;
      }
      const result = body as AssistantAnswer;
      setMessages((prev) => [
        ...prev,
        { id: nextId.current++, role: "assistant", text: result.answer, citations: result.citations ?? [] },
      ]);
    } catch {
      setError({ message: "Network error — please try again", retry: text });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function retry() {
    if (!error) return;
    const text = error.retry;
    // Drop the question that failed so it is not shown twice.
    setMessages((prev) => (prev[prev.length - 1]?.role === "user" ? prev.slice(0, -1) : prev));
    void ask(text);
  }

  const empty = messages.length === 0 && !loading;

  return (
    // Fixed height that follows the screen and never grows with the conversation: header and input stay put and only
    // the messages scroll. The 22rem leaves room for the page header, tabs and footer line, so the whole tab fits in
    // its scroll area and the bottom fade never covers the input. svh keeps it right on phones with changing bars.
    <section className="flex h-[clamp(24rem,calc(100svh-22rem),48rem)] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400">
            <Sparkles size={17} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Ask AI</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Answers come only from this project&apos;s own documentation.
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <Trash2 size={13} />
            Clear chat
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
        {empty ? (
          <div className="mx-auto flex max-w-xl flex-col items-center py-4 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400">
              <Sparkles size={22} />
            </span>
            <h3 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Ask anything about this project
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Pick a question to start, or type your own below.
            </p>
            <div className="mt-5 grid w-full gap-2">
              {SUGGESTIONS.map(({ icon: Icon, label, hint }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => void ask(label)}
                  className="group flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-left transition-colors hover:border-orange-300 hover:bg-orange-50/60 dark:border-zinc-800 dark:hover:border-orange-900 dark:hover:bg-orange-950/30"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 group-hover:bg-orange-100 group-hover:text-orange-600 dark:bg-zinc-800 dark:group-hover:bg-orange-950">
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</span>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-orange-600 px-4 py-2.5 text-sm text-white dark:bg-orange-500">
                    {m.text}
                  </p>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-2.5">
                  <AssistantAvatar />
                  <div className="min-w-0 max-w-[90%] flex-1">
                    <div className="rounded-2xl rounded-tl-sm bg-zinc-100 px-4 py-3 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                      <MarkdownView content={m.text} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-1">
                      {m.citations.length > 0 && (
                        <span className="text-xs text-zinc-400">Sources</span>
                      )}
                      {m.citations.map((c) => (
                        <Link
                          key={c.documentId}
                          href={`/projects/${projectId}/documents/${c.documentId}`}
                          className="inline-flex max-w-[16rem] items-center gap-1 rounded-full border border-zinc-200 px-2 py-0.5 text-xs text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          <FileText size={11} className="shrink-0" />
                          <span className="truncate">{c.title}</span>
                        </Link>
                      ))}
                      <span className="ml-auto">
                        <CopyButton text={m.text} />
                      </span>
                    </div>
                  </div>
                </div>
              ),
            )}
            {loading && <Thinking />}
            {error && (
              <div className="flex items-start gap-2.5">
                <AssistantAvatar />
                <div className="rounded-2xl rounded-tl-sm bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                  <p>{error.message}</p>
                  <button
                    type="button"
                    onClick={retry}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
                  >
                    <RotateCcw size={12} />
                    Try again
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
        className="shrink-0 border-t border-zinc-100 p-3 dark:border-zinc-800 sm:p-4"
      >
        <div className="flex items-end gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-400/20 dark:border-zinc-700 dark:bg-zinc-900">
          <textarea
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void ask(question);
              }
            }}
            rows={1}
            maxLength={MAX_QUESTION_LENGTH}
            placeholder="Ask a question about this project…"
            disabled={loading}
            className="max-h-28 min-h-[1.75rem] flex-1 resize-none bg-transparent py-1 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-60 dark:text-zinc-100"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={loading || !question.trim()}
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg text-white transition-colors",
              "bg-orange-600 hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600",
            )}
          >
            <ArrowUp size={16} />
          </button>
        </div>
        <p className="mt-1.5 flex justify-between px-1 text-[11px] text-zinc-400">
          <span>Enter to send · Shift+Enter for a new line</span>
          {question.length > MAX_QUESTION_LENGTH * 0.8 && (
            <span>
              {question.length}/{MAX_QUESTION_LENGTH}
            </span>
          )}
        </p>
      </form>
    </section>
  );
}
