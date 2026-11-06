"use client";

import { useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { useClickOutside } from "@/lib/useClickOutside";
import { BASE_FONT_SIZE, FONT_SIZE_PRESETS, MAX_FONT_SIZE, MIN_FONT_SIZE } from "@/lib/fontSize";

/** The size of the selected text in points-like pixels (the editor's normal size when nothing is set). */
export function currentFontSize(editor: Editor): number {
  const size = editor.getAttributes("textSize").size as number | null | undefined;
  return typeof size === "number" ? size : BASE_FONT_SIZE;
}

export function setFontSize(editor: Editor, size: number) {
  const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(size)));
  if (clamped === BASE_FONT_SIZE) editor.chain().focus().unsetMark("textSize").run();
  else editor.chain().focus().setMark("textSize", { size: clamped }).run();
}

/** The next preset above or below the current size, for the − and + buttons. */
export function stepFontSize(editor: Editor, dir: 1 | -1) {
  const now = currentFontSize(editor);
  const next = dir > 0 ? FONT_SIZE_PRESETS.find((p) => p > now) : [...FONT_SIZE_PRESETS].reverse().find((p) => p < now);
  setFontSize(editor, next ?? now + dir);
}

/** Word-style font size: − and + buttons, a number you can type, and a list of common sizes. */
export function FontSizeControl({ editor }: { editor: Editor }) {
  const size = currentFontSize(editor);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  const commit = () => {
    const n = Number(draft);
    if (draft !== null && Number.isFinite(n) && n > 0) setFontSize(editor, n);
    setDraft(null);
  };
  const button = "flex h-7 w-6 items-center justify-center transition-colors hover:bg-zinc-300/80 dark:hover:bg-zinc-700";

  return (
    <div ref={ref} className="relative">
      <div className={cn("flex items-stretch overflow-hidden rounded text-zinc-500 dark:text-zinc-400", size !== BASE_FONT_SIZE ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400" : "bg-zinc-200/80 dark:bg-zinc-800")}>
        <button type="button" title="Decrease font size" aria-label="Decrease font size" onMouseDown={(e) => e.preventDefault()} onClick={() => stepFontSize(editor, -1)} className={button}>
          <Minus size={13} />
        </button>
        <input
          value={draft ?? String(size)}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
          onFocus={(e) => e.target.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
              editor.commands.focus();
            } else if (e.key === "Escape") {
              setDraft(null);
              editor.commands.focus();
            }
          }}
          inputMode="numeric"
          aria-label="Font size"
          title="Font size"
          className="h-7 w-9 border-x border-zinc-300/60 bg-transparent text-center text-xs font-medium tabular-nums text-zinc-800 outline-none focus:bg-white dark:border-zinc-700/80 dark:text-zinc-100 dark:focus:bg-zinc-900"
        />
        <button type="button" title="Increase font size" aria-label="Increase font size" onMouseDown={(e) => e.preventDefault()} onClick={() => stepFontSize(editor, 1)} className={button}>
          <Plus size={13} />
        </button>
        <button type="button" title="Common sizes" aria-label="Common sizes" aria-expanded={open} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((v) => !v)} className={cn(button, "w-5 border-l border-zinc-300/60 dark:border-zinc-700/80")}>
          <ChevronDown size={12} />
        </button>
      </div>
      {open && (
        <div role="listbox" aria-label="Font sizes" className="absolute left-0 top-full z-30 mt-1 max-h-72 w-28 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {FONT_SIZE_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              role="option"
              aria-selected={p === size}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setFontSize(editor, p);
                setOpen(false);
              }}
              className={cn("flex w-full items-center justify-between px-3 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800", p === size ? "font-semibold text-orange-600 dark:text-orange-400" : "text-zinc-700 dark:text-zinc-200")}
            >
              {p}
              {p === BASE_FONT_SIZE && <span className="text-[10px] text-zinc-400">normal</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
