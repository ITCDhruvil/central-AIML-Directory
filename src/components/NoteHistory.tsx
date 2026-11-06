"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { MarkdownView } from "@/components/MarkdownView";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";

type VersionSummary = { id: string; createdAt: string; authorName: string | null; length: number; preview: string };

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/**
 * Earlier copies of a note. Pick one to read it, then restore it: the note takes that text (the text it replaces is
 * kept as a restore point too, so a restore can itself be undone).
 */
export function NoteHistory({ apiBase, noteKey, canRestore, onRestore, onClose }: { apiBase: string; noteKey: string; canRestore: boolean; onRestore: (content: string) => void; onClose: () => void }) {
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; content: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`${apiBase}/versions?key=${encodeURIComponent(noteKey)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((b) => live && setVersions(b.versions ?? []))
      .catch(() => live && (setVersions([]), setError("Could not load the history.")));
    return () => {
      live = false;
    };
  }, [apiBase, noteKey]);

  function pick(id: string) {
    setSelected(id);
    setPreview(null);
    fetch(`${apiBase}/versions/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((b) => setPreview({ id, content: b.version.content }))
      .catch(() => setError("Could not open that version."));
  }

  return (
    <Modal open onClose={onClose} title="Version history" description="Earlier copies of this note, newest first." className="max-w-3xl">
      <div className="grid min-h-[20rem] gap-4 sm:grid-cols-[14rem_1fr]">
        <div className="max-h-[26rem] space-y-1 overflow-y-auto pr-1">
          {versions === null && <p className="text-sm text-zinc-400">Loading…</p>}
          {versions?.length === 0 && <p className="text-sm text-zinc-400">No earlier copies yet. One is kept automatically when you change a note after a pause, or after a big edit.</p>}
          {versions?.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => pick(v.id)}
              className={cn("block w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800", selected === v.id && "bg-orange-50 dark:bg-orange-500/10")}
            >
              <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">{when(v.createdAt)}</span>
              <span className="block truncate text-xs text-zinc-500">{v.preview || "(empty)"}</span>
              <span className="block text-[11px] text-zinc-400">
                {v.length.toLocaleString()} characters{v.authorName ? ` · ${v.authorName}` : ""}
              </span>
            </button>
          ))}
        </div>
        <div className="min-w-0">
          {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          {!selected ? (
            <p className="flex h-full items-center justify-center text-sm text-zinc-400">Select a version to read it.</p>
          ) : !preview ? (
            <p className="text-sm text-zinc-400">Loading…</p>
          ) : (
            <div className="flex h-full flex-col gap-3">
              <div className="max-h-[22rem] flex-1 overflow-y-auto rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <MarkdownView content={preview.content} />
              </div>
              {canRestore && (
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={RotateCcw}
                    onClick={() => {
                      onRestore(preview.content);
                      onClose();
                    }}
                  >
                    Restore this version
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
