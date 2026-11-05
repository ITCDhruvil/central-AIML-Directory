"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ClipboardList, ListChecks, Sparkles, StickyNote, WandSparkles } from "lucide-react";
import { MarkdownView } from "@/components/MarkdownView";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Loader } from "@/components/prompt-kit/loader";
import { TextShimmer } from "@/components/prompt-kit/text-shimmer";
import { EmptyState } from "@/components/EmptyState";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { NoteAiAction } from "@/lib/ai/noteAi";
import type { ProjectNoteView } from "@/lib/projectNote";

type SaveState = "idle" | "saving" | "saved" | "error";

const AI_ACTIONS: { action: NoteAiAction; label: string; icon: typeof Sparkles; heading: string }[] = [
  { action: "summarize", label: "Summarize", icon: Sparkles, heading: "Summary" },
  { action: "action-items", label: "Action items", icon: ListChecks, heading: "Action items" },
  { action: "key-points", label: "Key points", icon: ClipboardList, heading: "Key points" },
  { action: "cleanup", label: "Clean up", icon: WandSparkles, heading: "" },
];

export function ProjectNotes({
  projectId,
  initial,
  canEdit,
  canUseAi,
}: {
  projectId: string;
  initial: ProjectNoteView;
  canEdit: boolean;
  canUseAi: boolean;
}) {
  const [content, setContent] = useState(initial.content);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedInfo, setSavedInfo] = useState<{ name: string | null; at: string | null }>({ name: initial.updatedByName, at: initial.updatedAt });
  const [aiBusy, setAiBusy] = useState<NoteAiAction | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const savedContent = useRef(initial.content);
  const timer = useRef<number | undefined>(undefined);

  const save = useCallback(
    async (next: string) => {
      if (next === savedContent.current) return;
      setSaveState("saving");
      try {
        const res = await fetch(`/api/projects/${projectId}/note`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: next }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSaveState("error");
          return;
        }
        savedContent.current = next;
        setSavedInfo({ name: body.note?.updatedByName ?? null, at: body.note?.updatedAt ?? null });
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [projectId],
  );

  // Autosave ~1.2s after typing stops.
  useEffect(() => {
    if (!canEdit || content === savedContent.current) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(content), 1200);
    return () => window.clearTimeout(timer.current);
  }, [content, canEdit, save]);

  // Save anything pending when leaving the page.
  useEffect(() => {
    return () => {
      if (content !== savedContent.current) void save(content);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runAi(action: NoteAiAction) {
    if (aiBusy) return;
    if (!content.trim()) {
      setAiError("Write some notes first, then let AI help.");
      return;
    }
    setAiBusy(action);
    setAiError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/note/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text: content }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(body.error ?? "The AI tool is unavailable right now.");
        return;
      }
      const result: string = body.text ?? "";
      const heading = AI_ACTIONS.find((a) => a.action === action)?.heading;
      // Clean up replaces the whole note; the others append their result under a heading.
      setContent((prev) => (action === "cleanup" ? result : `${prev.trimEnd()}\n\n## ${heading}\n\n${result}\n`));
    } catch {
      setAiError("Network error — please try again.");
    } finally {
      setAiBusy(null);
    }
  }

  if (!canEdit) {
    return content.trim() ? (
      <div className="rounded-xl border border-zinc-200 bg-white px-6 py-7 dark:border-zinc-800 dark:bg-zinc-900 sm:px-8">
        <MarkdownView content={content} />
      </div>
    ) : (
      <EmptyState icon={StickyNote} title="No notes yet" description="Nobody has added notes to this project yet." />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {canUseAi &&
            AI_ACTIONS.map(({ action, label, icon: Icon }) => (
              <button
                key={action}
                type="button"
                onClick={() => void runAi(action)}
                disabled={aiBusy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-orange-300 hover:text-orange-600 disabled:cursor-wait disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-orange-500/50 dark:hover:text-orange-400"
              >
                {aiBusy === action ? <Loader size={13} /> : <Icon size={13} className="text-orange-500" />}
                {label}
              </button>
            ))}
        </div>
        <span className="flex items-center gap-1.5 text-xs text-zinc-400" aria-live="polite">
          {saveState === "saving" && <TextShimmer className="text-xs">Saving…</TextShimmer>}
          {saveState === "saved" && (
            <>
              <Check size={13} className="text-green-600 dark:text-green-400" /> Saved
            </>
          )}
          {saveState === "error" && <span className="text-red-600 dark:text-red-400">Couldn&apos;t save</span>}
          {saveState === "idle" && savedInfo.at && (
            <span suppressHydrationWarning>
              {savedInfo.name ? `${savedInfo.name} · ` : ""}
              {formatRelativeTime(savedInfo.at)}
            </span>
          )}
        </span>
      </div>

      {aiBusy && (
        <div className="flex items-center gap-2 rounded-lg bg-orange-50/60 px-3 py-2 text-sm dark:bg-orange-500/5" aria-live="polite">
          <Loader size="sm" className="text-orange-500" />
          <TextShimmer className="text-sm">Working on your notes…</TextShimmer>
        </div>
      )}
      {aiError && <p className="text-sm text-amber-600 dark:text-amber-400">{aiError}</p>}

      <RichTextEditor value={content} onChange={setContent} placeholder="Jot down meeting notes, decisions, to-dos… Use the toolbar for formatting and AI, or the buttons above." className="min-h-[28rem]" />
      <p className="text-xs text-zinc-400">Notes save automatically. Everyone who can edit this project shares this notepad.</p>
    </div>
  );
}
