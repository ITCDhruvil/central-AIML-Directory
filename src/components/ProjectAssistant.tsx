"use client";

import { useState } from "react";
import Link from "next/link";
import { CornerDownLeft, FileText, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MarkdownView } from "@/components/MarkdownView";

interface Citation {
  documentId: string;
  title: string;
  category: string;
}

interface AssistantAnswer {
  answer: string;
  citations: Citation[];
}

interface HistoryEntry {
  question: string;
  result: AssistantAnswer;
}

const SUGGESTED_QUESTIONS = [
  "What is this project about?",
  "How do I set this project up locally?",
  "What technologies does this project use?",
];

const MAX_QUESTION_LENGTH = 500;

export function ProjectAssistant({ projectId }: { projectId: string }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to answer the question");
        return;
      }
      setHistory((prev) => [...prev, { question: trimmed, result: body as AssistantAnswer }]);
      setQuestion("");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-1.5">
        <Sparkles size={15} className="text-orange-500" />
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Project Knowledge</h2>
      </div>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        Answers are generated only from this project&apos;s own documentation.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTED_QUESTIONS.map((q) => (
          <Button key={q} variant="secondary" size="sm" className="rounded-full" onClick={() => ask(q)} disabled={loading}>
            {q}
          </Button>
        ))}
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
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={MAX_QUESTION_LENGTH}
            placeholder="Ask a question about this project..."
            disabled={loading}
            className="field w-full pr-10"
          />
          {(loading || question.trim()) && (
            <button
              type="submit"
              aria-label={loading ? "Thinking" : "Ask"}
              title="Press Enter to ask"
              disabled={loading || !question.trim()}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 hover:text-orange-600 disabled:opacity-40 dark:hover:text-orange-400"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CornerDownLeft size={16} />}
            </button>
          )}
        </div>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {history.length > 0 && (
        <div className="mt-4 space-y-4">
          {history.map((entry, i) => (
            <div key={i} className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{entry.question}</p>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                <MarkdownView content={entry.result.answer} />
              </div>
              {entry.result.citations.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Sources</p>
                  <ul className="mt-1 space-y-0.5">
                    {entry.result.citations.map((c) => (
                      <li key={c.documentId}>
                        <Link
                          href={`/projects/${projectId}/documents/${c.documentId}`}
                          className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
                        >
                          <FileText size={12} />
                          {c.title} ({c.category})
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
