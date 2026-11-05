"use client";

import { useState } from "react";
import { Check, Copy, RotateCcw, Sparkles } from "lucide-react";
import { MarkdownView } from "@/components/MarkdownView";
import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/prompt-kit/loader";
import { TextShimmer } from "@/components/prompt-kit/text-shimmer";

/** One-click AI summary of what changed across the directory in the last 7 days. For people with full access. */
export function WeeklyDigest() {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/digest", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Could not write the digest.");
        setState("error");
        return;
      }
      setSummary(body.summary ?? "");
      setState("ready");
    } catch {
      setError("Network error — please try again.");
      setState("error");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Sparkles size={16} className="text-orange-500" />
            Weekly digest
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">An AI summary of what changed across the directory in the last 7 days.</p>
        </div>
        {state === "ready" ? (
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" icon={copied ? Check : Copy} onClick={() => void copy()}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => void generate()}>
              Regenerate
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="secondary" icon={state === "loading" ? undefined : Sparkles} loading={state === "loading"} onClick={() => void generate()}>
            {state === "loading" ? "Writing…" : "Generate"}
          </Button>
        )}
      </div>

      {state === "loading" && (
        <div className="mt-4 flex items-center gap-2.5" aria-live="polite">
          <Loader size="sm" className="text-zinc-400" />
          <TextShimmer className="text-sm">Reading the week&apos;s activity…</TextShimmer>
        </div>
      )}

      {state === "error" && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {state === "ready" && (
        <div className="mt-4 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
          <MarkdownView content={summary} />
        </div>
      )}
    </div>
  );
}
