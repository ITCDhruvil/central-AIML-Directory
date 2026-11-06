"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Check, Copy, Download, NotebookPen, RotateCcw, Sparkles, X } from "lucide-react";
import { MarkdownView } from "@/components/MarkdownView";
import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/prompt-kit/loader";
import { TextShimmer } from "@/components/prompt-kit/text-shimmer";

const STORAGE_KEY = "weekly-digest";
const CHANGE_EVENT = "weekly-digest-change";

type Saved = { summary: string; at: number };

// The digest is kept in this browser until someone presses Close, so leaving the page and coming back shows it again
// instead of asking for a fresh (slow, paid) generation every time.
function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
const readRaw = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};
function writeSaved(value: Saved | null) {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked: the digest then lasts only until the page is left
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** One-click AI summary of what changed across the directory in the last 7 days. For people with full access. */
export function WeeklyDigest() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const saved: Saved | null = (() => {
    try {
      const parsed = raw ? (JSON.parse(raw) as Saved) : null;
      return parsed && typeof parsed.summary === "string" ? parsed : null;
    } catch {
      return null;
    }
  })();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function generate() {
    setLoading(true);
    setError("");
    setNoteState("idle");
    try {
      const res = await fetch("/api/digest", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Could not write the digest.");
        return;
      }
      writeSaved({ summary: String(body.summary ?? ""), at: Date.now() });
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!saved) return;
    try {
      await navigator.clipboard.writeText(saved.summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked
    }
  }

  function download() {
    if (!saved) return;
    const blob = new Blob([saved.summary], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weekly-digest-${today()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Adds the digest to the end of today's note. */
  async function saveToNotes() {
    if (!saved) return;
    setNoteState("saving");
    try {
      const day = today();
      const current = await fetch(`/api/me/day-notes/${day}`).then((r) => (r.ok ? r.json() : { note: null }));
      const existing: string = current.note?.content ?? "";
      const content = `${existing.trimEnd()}${existing.trim() ? "\n\n" : ""}## Weekly digest\n\n${saved.summary}`;
      const res = await fetch(`/api/me/day-notes/${day}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
      setNoteState(res.ok ? "saved" : "error");
    } catch {
      setNoteState("error");
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
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {saved ? `Written ${new Date(saved.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}. It stays here until you close it.` : "An AI summary of what changed across the directory in the last 7 days."}
          </p>
        </div>
        {saved ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="ghost" icon={copied ? Check : Copy} onClick={() => void copy()}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" variant="ghost" icon={Download} onClick={download}>
              Download
            </Button>
            <Button size="sm" variant="ghost" icon={NotebookPen} loading={noteState === "saving"} onClick={() => void saveToNotes()}>
              {noteState === "saved" ? "Added to notes" : "Add to my notes"}
            </Button>
            <Button size="sm" variant="secondary" icon={loading ? undefined : RotateCcw} loading={loading} onClick={() => void generate()}>
              {loading ? "Writing…" : "Regenerate"}
            </Button>
            <button
              type="button"
              onClick={() => {
                writeSaved(null);
                setNoteState("idle");
              }}
              aria-label="Close the digest"
              title="Close"
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <Button size="sm" variant="secondary" icon={loading ? undefined : Sparkles} loading={loading} onClick={() => void generate()}>
            {loading ? "Writing…" : "Generate"}
          </Button>
        )}
      </div>

      {loading && !saved && (
        <div className="mt-4 flex items-center gap-2.5" aria-live="polite">
          <Loader size="sm" className="text-zinc-400" />
          <TextShimmer className="text-sm">Reading the week&apos;s activity…</TextShimmer>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {saved && (
        <div className="mt-4 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
          {loading && (
            <div className="mb-3 flex items-center gap-2.5" aria-live="polite">
              <Loader size="sm" className="text-zinc-400" />
              <TextShimmer className="text-sm">Writing a fresh digest…</TextShimmer>
            </div>
          )}
          <MarkdownView content={saved.summary} />
          {noteState === "saved" && (
            <p className="mt-3 text-xs text-zinc-500">
              Saved to today&apos;s note.{" "}
              <Link href="/notes" className="font-medium text-orange-600 hover:underline dark:text-orange-400">
                Open my notes
              </Link>
            </p>
          )}
          {noteState === "error" && <p className="mt-3 text-xs text-red-600 dark:text-red-400">Could not add it to your notes. Please try again.</p>}
        </div>
      )}
    </div>
  );
}
