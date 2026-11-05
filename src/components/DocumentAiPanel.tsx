"use client";

import { useState } from "react";
import { ArrowUp, Check, Copy, FileText, Sparkles } from "lucide-react";
import { MarkdownView } from "@/components/MarkdownView";
import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/prompt-kit/loader";
import { TextShimmer } from "@/components/prompt-kit/text-shimmer";

const SUGGESTIONS = ["What are the key points?", "List any action items or next steps.", "Explain this in simple terms."];

function CopyAnswer({ text }: { text: string }) {
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
          // clipboard blocked
        }
      }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** Summarize a document or ask a question about it. Reuses the read-only document AI endpoint. */
export function DocumentAiPanel({ projectId, documentId }: { projectId: string; documentId: string }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState<null | "summary" | "question">(null);
  const [answer, setAnswer] = useState<{ label: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "summary" | "question", q: string, label: string) {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/documents/${documentId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "summary" ? {} : { question: q }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Something went wrong.");
        return;
      }
      setAnswer({ label, text: body.answer ?? "" });
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    void run("question", trimmed, trimmed);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <Sparkles size={16} className="text-orange-500" />
          Ask AI about this document
        </h2>
        <Button size="sm" variant="secondary" icon={FileText} loading={busy === "summary"} onClick={() => void run("summary", "", "Summary")}>
          Summarize
        </Button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="mt-3"
      >
        <div className="relative">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={500}
            placeholder="Ask a question about this document…"
            disabled={busy !== null}
            className="field w-full pr-11"
          />
          <button
            type="submit"
            disabled={busy !== null || !question.trim()}
            aria-label="Ask"
            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-orange-600 text-white transition-colors hover:bg-orange-500 disabled:opacity-40 dark:bg-orange-500"
          >
            <ArrowUp size={15} />
          </button>
        </div>
      </form>

      {!answer && busy === null && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((sug) => (
            <button
              key={sug}
              type="button"
              onClick={() => ask(sug)}
              className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              {sug}
            </button>
          ))}
        </div>
      )}

      {busy !== null && (
        <div className="mt-4 flex items-center gap-2.5" aria-live="polite">
          <Loader size="sm" className="text-zinc-400" />
          <TextShimmer className="text-sm">{busy === "summary" ? "Reading the document…" : "Thinking…"}</TextShimmer>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {answer && busy === null && (
        <div className="mt-4 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">{answer.label}</p>
            <CopyAnswer text={answer.text} />
          </div>
          <MarkdownView content={answer.text} />
        </div>
      )}
    </div>
  );
}
