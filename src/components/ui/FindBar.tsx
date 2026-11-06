"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { CaseSensitive, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { getFind, replaceAll, replaceCurrent, revealCurrent, setFind, stepFind } from "@/components/ui/FindReplace";

/** Find and replace for the editor. Opens with Ctrl/Cmd+F while the editor has focus, or from the toolbar. */
export function FindBar({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [, setTick] = useState(0);
  const findInput = useRef<HTMLInputElement>(null);

  // Open from Ctrl/Cmd+F (inside the editor) or an "open-find" event from the toolbar.
  useEffect(() => {
    const dom = editor.view.dom;
    const show = () => {
      const { from, to, empty } = editor.state.selection;
      const picked = !empty && to - from < 80 ? editor.state.doc.textBetween(from, to, " ") : "";
      if (picked) setQuery(picked);
      setOpen(true);
      requestAnimationFrame(() => findInput.current?.select());
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        show();
      }
    };
    dom.addEventListener("keydown", onKey);
    dom.addEventListener("open-find", show);
    return () => {
      dom.removeEventListener("keydown", onKey);
      dom.removeEventListener("open-find", show);
    };
  }, [editor]);

  // Keep the count in step with edits.
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    editor.on("transaction", bump);
    return () => void editor.off("transaction", bump);
  }, [editor]);

  // Push the search into the editor while the bar is open; clear the highlights when it closes.
  useEffect(() => {
    setFind(editor, open ? { query, caseSensitive } : { query: "" });
    if (open && query) revealCurrent(editor);
  }, [editor, open, query, caseSensitive]);

  if (!open) return null;
  const state = getFind(editor);
  const total = state.matches.length;

  function close() {
    setOpen(false);
    editor.commands.focus();
  }

  const iconBtn = "flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800";
  const field = "min-w-0 flex-1 rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-sm outline-none focus:border-orange-400 dark:border-zinc-700 text-zinc-900 placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500";

  return (
    <div role="search" className="absolute right-3 top-2 z-20 w-80 max-w-[calc(100%-1.5rem)] rounded-lg border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center gap-1">
        <Search size={14} className="mx-1 shrink-0 text-zinc-400" />
        <input
          ref={findInput}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              stepFind(editor, e.shiftKey ? -1 : 1);
            } else if (e.key === "Escape") close();
          }}
          placeholder="Find"
          aria-label="Find"
          className={field}
        />
        <span className="w-14 shrink-0 text-center text-xs text-zinc-500">{query ? (total ? `${state.current + 1} / ${total}` : "None") : ""}</span>
        <button type="button" title="Match case" aria-label="Match case" aria-pressed={caseSensitive} onClick={() => setCaseSensitive((v) => !v)} className={cn(iconBtn, caseSensitive && "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400")}>
          <CaseSensitive size={15} />
        </button>
        <button type="button" title="Previous (Shift+Enter)" aria-label="Previous match" disabled={!total} onClick={() => stepFind(editor, -1)} className={iconBtn}>
          <ChevronUp size={15} />
        </button>
        <button type="button" title="Next (Enter)" aria-label="Next match" disabled={!total} onClick={() => stepFind(editor, 1)} className={iconBtn}>
          <ChevronDown size={15} />
        </button>
        <button type="button" title="Close" aria-label="Close find" onClick={close} className={iconBtn}>
          <X size={15} />
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        <span className="w-[22px] shrink-0" />
        <input
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              replaceCurrent(editor, replacement);
            } else if (e.key === "Escape") close();
          }}
          placeholder="Replace with"
          aria-label="Replace with"
          className={field}
        />
        <button type="button" disabled={!total} onClick={() => replaceCurrent(editor, replacement)} className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800">
          Replace
        </button>
        <button type="button" disabled={!total} onClick={() => replaceAll(editor, replacement)} className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800">
          All
        </button>
      </div>
    </div>
  );
}
