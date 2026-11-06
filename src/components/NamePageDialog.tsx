"use client";

import { useState } from "react";
import { FilePlus2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

const SUGGESTIONS = ["Meeting", "Ideas", "To-do", "Decisions", "Scratch"];

/** Asks for a page's name: a clean replacement for the browser's own prompt box. */
export function NamePageDialog({ mode, initial = "", where, busy = false, onSubmit, onClose }: { mode: "new" | "rename"; initial?: string; where: string; busy?: boolean; onSubmit: (title: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState(initial);
  const Icon = mode === "new" ? FilePlus2 : Pencil;

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "new" ? "New page" : "Rename page"}
      description={mode === "new" ? `Adds a page to ${where}.` : undefined}
      className="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(title.trim())} loading={busy}>
            {mode === "new" ? "Add page" : "Save"}
          </Button>
        </div>
      }
    >
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400" htmlFor="page-name">
        <Icon size={13} /> Page name
      </label>
      <input
        id="page-name"
        autoFocus
        value={title}
        maxLength={60}
        onChange={(e) => setTitle(e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit(title.trim());
          }
        }}
        placeholder="Optional, for example Meeting"
        className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-500"
      />
      <p className="mt-1.5 text-xs text-zinc-400">Leave it empty to name it Page 1, Page 2 and so on.</p>
      {mode === "new" && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTitle(s)}
              className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 transition-colors hover:border-orange-300 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-orange-500/50 dark:hover:text-orange-400"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
