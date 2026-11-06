"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { FileText, FolderKanban, Lightbulb, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SearchResponse } from "@/lib/search/types";

type Hit = { key: string; label: string; hint: string; href: string | null; icon: LucideIcon };

/** Typing "@" and a few letters offers projects, ideas and documents; picking one inserts a link to it. */
export function MentionMenu({ editor }: { editor: Editor }) {
  const [state, setState] = useState<{ query: string; from: number; to: number; top: number; left: number } | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const dismissed = useRef<number | null>(null);

  // Watch for "@word" right before the cursor.
  useEffect(() => {
    const update = () => {
      const { selection } = editor.state;
      if (!selection.empty || editor.isActive("codeBlock")) return setState(null);
      const $from = selection.$from;
      const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "￼");
      const m = /(?:^|\s)@([^\s@]{0,30})$/.exec(before);
      if (!m) {
        dismissed.current = null;
        return setState(null);
      }
      const to = selection.from;
      const from = to - m[1].length - 1;
      if (dismissed.current === from) return setState(null);
      const c = editor.view.coordsAtPos(to);
      setState({ query: m[1], from, to, top: c.bottom + 4, left: c.left });
    };
    editor.on("selectionUpdate", update);
    editor.on("update", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("update", update);
    };
  }, [editor]);

  // Search as the person types (short pause first).
  const query = state?.query ?? null;
  useEffect(() => {
    if (query === null) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // People and everything else are looked up together; a person is listed even before anything is typed.
        const [people, found] = await Promise.all([
          fetch(`/api/mentions/users?q=${encodeURIComponent(query)}`, { signal: controller.signal }).then((r) => (r.ok ? r.json() : { users: [] })),
          query.trim()
            ? fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal }).then((r) => (r.ok ? (r.json() as Promise<SearchResponse>) : null))
            : Promise.resolve(null),
        ]);
        const next: Hit[] = [
          ...((people.users ?? []) as { id: string; name: string }[]).map((u) => ({ key: `u-${u.id}`, label: u.name, hint: "Person", href: null, icon: User })),
          ...(found?.projects ?? []).slice(0, 4).map((r) => ({ key: `p-${r.project.id}`, label: r.project.name, hint: "Project", href: `/projects/${r.project.id}`, icon: FolderKanban })),
          ...(found?.ideas ?? []).slice(0, 3).map((r) => ({ key: `i-${r.idea.id}`, label: r.idea.name, hint: "Idea", href: `/ideas/${r.idea.id}`, icon: Lightbulb })),
          ...(found?.documentation ?? []).slice(0, 3).map((r) => ({ key: `d-${r.document.id}`, label: r.document.title, hint: `Document \u00b7 ${r.project.name}`, href: `/projects/${r.project.id}`, icon: FileText })),
        ];
        setHits(next);
        setHighlight(0);
      } catch {
        // aborted or offline: keep what is shown
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function pick(hit: Hit) {
    if (!state) return;
    editor
      .chain()
      .focus()
      .deleteRange({ from: state.from, to: state.to })
      .insertContent([
        { type: "text", text: `@${hit.label}`, marks: hit.href ? [{ type: "link", attrs: { href: hit.href } }] : [{ type: "bold" }] },
        { type: "text", text: " " },
      ])
      .run();
    setState(null);
  }

    const shownHits = state ? hits : [];
  const open = state !== null;
  // Arrow keys, Enter and Escape drive the list while it is open.
  useEffect(() => {
    if (!open) return;
    const dom = editor.view.dom;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismissed.current = state?.from ?? null;
        setState(null);
        return;
      }
      if (shownHits.length === 0) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setHighlight((h) => (e.key === "ArrowDown" ? Math.min(h + 1, shownHits.length - 1) : Math.max(h - 1, 0)));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        pick(shownHits[highlight] ?? shownHits[0]);
      }
    };
    dom.addEventListener("keydown", onKey, true);
    return () => dom.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shownHits, highlight, state]);

  if (!state) return null;
  return (
    <div style={{ top: state.top, left: Math.min(state.left, window.innerWidth - 296) }} className="fixed z-40 w-72 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      {shownHits.length === 0 ? (
        <p className="px-3 py-2 text-sm text-zinc-400">{!state.query.trim() ? "Type to search projects, ideas and documents" : loading ? "Searching…" : "No matches"}</p>
      ) : (
        shownHits.map((h, i) => (
          <button
            key={h.key}
            type="button"
            onMouseEnter={() => setHighlight(i)}
            onMouseDown={(e) => {
              e.preventDefault();
              pick(h);
            }}
            className={cn("flex w-full items-center gap-2.5 px-3 py-1.5 text-left", i === highlight && "bg-zinc-100 dark:bg-zinc-800")}
          >
            <h.icon size={15} className="shrink-0 text-zinc-500 dark:text-zinc-400" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{h.label}</span>
              <span className="block truncate text-xs text-zinc-400">{h.hint}</span>
            </span>
          </button>
        ))
      )}
    </div>
  );
}
