"use client";

import { useEffect, useRef, useState } from "react";
import { createNodeFromContent } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  ChevronDown,
  Code,
  CornerDownLeft,
  Heading2,
  Italic,
  Languages,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  PencilLine,
  Quote,
  Scissors,
  Sparkles,
  Strikethrough,
  Underline,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { Loader } from "@/components/prompt-kit/loader";
import { cn } from "@/lib/cn";

type Pos = { top: number; left: number };
type Run = { kind: "transform"; action: string; tone?: string; language?: string } | { kind: "custom"; prompt: string };
type AiItem = { label: string; icon: LucideIcon; run: Run };

const WIDTH = 392;
const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese (Brazilian)", "Japanese"];

const AI_ITEMS: AiItem[] = [
  { label: "Improve writing", icon: WandSparkles, run: { kind: "transform", action: "improve" } },
  { label: "Fix spelling & grammar", icon: Scissors, run: { kind: "transform", action: "fix-grammar" } },
  { label: "Make shorter", icon: Minimize2, run: { kind: "transform", action: "shorten" } },
  { label: "Make longer", icon: Maximize2, run: { kind: "transform", action: "lengthen" } },
  { label: "Simplify the language", icon: Sparkles, run: { kind: "custom", prompt: "Rewrite this in simpler, plainer language that is easy to understand." } },
];
const TONES = ["Professional", "Friendly", "Confident", "Casual"];

const BTN =
  "flex h-7 w-7 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";
const BTN_ON = "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400";

/**
 * A floating bar that appears above selected text: quick formatting (bold, italic, underline, strike, code, link,
 * heading, lists, quote) and an AI menu that rewrites just the selection (edit with a prompt, improve, fix, shorter,
 * longer, simplify, change tone, translate). Results replace the selection in one step, so Undo brings it back.
 */
export function SelectionToolbar({ editor, onBusy }: { editor: Editor; onBusy: (label: string | null, pos?: number) => void }) {
  const [pos, setPos] = useState<Pos | null>(null);
  const [mode, setMode] = useState<"bar" | "ai" | "prompt">("bar");
  const [promptValue, setPromptValue] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const range = useRef<{ from: number; to: number } | null>(null);
  const modeRef = useRef(mode);
  const dragging = useRef(false);
  const promptInput = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Show the bar above a non-empty text selection; hide it while dragging, in code blocks, and on node selections.
  useEffect(() => {
    function place(a: { top: number; bottom: number; left: number }, b: { top: number; bottom: number }) {
      const above = Math.min(a.top, b.top) - 46;
      setPos({
        top: above >= 8 ? above : Math.max(a.bottom, b.bottom) + 8,
        left: Math.max(8, Math.min(a.left, window.innerWidth - Math.min(WIDTH, window.innerWidth - 16) - 8)),
      });
    }

    function compute() {
      const { state, view } = editor;
      // While the AI menu is open the bar stays put on the selection it was opened for (and follows scroll/resize).
      if (modeRef.current !== "bar") {
        const r = range.current;
        if (!r) return;
        const max = state.doc.content.size;
        place(view.coordsAtPos(Math.min(r.from, max)), view.coordsAtPos(Math.min(r.to, max)));
        return;
      }
      if (dragging.current) {
        setPos(null);
        return;
      }
      const sel = state.selection;
      const isNode = Boolean((sel as unknown as { node?: unknown }).node);
      // Several selected table cells are a cell selection, not text: the text bar would sit on top of the table.
      const isCells = "$anchorCell" in (sel as object);
      if (sel.empty || isNode || isCells || !editor.isFocused || sel.$from.parent.type.name === "codeBlock") {
        setPos(null);
        return;
      }
      place(view.coordsAtPos(sel.from), view.coordsAtPos(sel.to));
    }
    const dom = editor.view.dom;
    const down = () => {
      dragging.current = true;
      if (modeRef.current === "bar") setPos(null);
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      window.setTimeout(compute, 0);
    };
    editor.on("selectionUpdate", compute);
    editor.on("focus", compute);
    editor.on("blur", compute);
    dom.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      editor.off("selectionUpdate", compute);
      editor.off("focus", compute);
      editor.off("blur", compute);
      dom.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [editor]);

  useEffect(() => {
    if (mode === "prompt") promptInput.current?.focus();
  }, [mode]);

  // The open AI menu closes when you click anywhere else, or press Escape.
  useEffect(() => {
    if (mode === "bar") return;
    function onDown(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) {
        setMode("bar");
        setPromptValue("");
        setPos(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !running) {
        setMode("bar");
        setPromptValue("");
        setPos(null);
      }
    }
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [mode, running]);

  function close() {
    setMode("bar");
    setPromptValue("");
    setPos(null);
  }

  function applyResult(markdown: string) {
    const r = range.current;
    if (!r) return;
    const text = markdown.trim();
    // Lists, headings, quotes or several paragraphs need block structure; a sentence or two stays inline.
    const isBlock = /\n\s*\n|^\s*([-*+] |\d+\. |#{1,6} |> )/m.test(text);
    if (!isBlock) {
      // insertContentAt already reads Markdown (inline), so the text goes in as-is.
      editor.chain().focus().insertContentAt(r, text).run();
      return;
    }
    const parser = (editor.storage.markdown as unknown as { parser: { parse: (md: string) => string } }).parser;
    const content = createNodeFromContent(parser.parse(text), editor.schema);
    const { tr } = editor.state;
    tr.replaceRange(r.from, r.to, new Slice(Fragment.from(content), 0, 0));
    editor.view.dispatch(tr.scrollIntoView());
    editor.commands.focus();
  }

  async function run(item: Run, label: string) {
    const r = range.current;
    if (!r || running) return;
    const selected = editor.state.doc.textBetween(r.from, r.to, "\n");
    if (!selected.trim()) return;
    setRunning(true);
    setError(null);
    onBusy(label, r.to);
    try {
      const res =
        item.kind === "transform"
          ? await fetch("/api/ai/transform-text", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: selected, action: item.action, tone: item.tone, language: item.language }),
            })
          : await fetch("/api/ai/compose", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "custom", prompt: item.prompt, text: selected }),
            });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "The AI tool is unavailable.");
        return;
      }
      applyResult(String(body.text ?? ""));
      close();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setRunning(false);
      onBusy(null);
    }
  }

  function openMenu(next: "ai" | "prompt") {
    const { from, to } = editor.state.selection;
    range.current = { from, to };
    setMode(next);
  }

  function setLink() {
    const previous = (editor.getAttributes("link").href as string | undefined) ?? "";
    const entered = window.prompt("Link address", previous);
    if (entered === null) return;
    if (!entered.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const href = /^(https?:|mailto:)/i.test(entered.trim()) ? entered.trim() : `https://${entered.trim()}`;
    editor.chain().focus().setLink({ href }).run();
  }

  const fmt: { icon: LucideIcon; title: string; active: boolean; act: () => void }[] = [
    { icon: Bold, title: "Bold", active: editor.isActive("bold"), act: () => editor.chain().focus().toggleBold().run() },
    { icon: Italic, title: "Italic", active: editor.isActive("italic"), act: () => editor.chain().focus().toggleItalic().run() },
    { icon: Underline, title: "Underline", active: editor.isActive("underline"), act: () => editor.chain().focus().toggleUnderline().run() },
    { icon: Strikethrough, title: "Strikethrough", active: editor.isActive("strike"), act: () => editor.chain().focus().toggleStrike().run() },
    { icon: Code, title: "Inline code", active: editor.isActive("code"), act: () => editor.chain().focus().toggleCode().run() },
    { icon: Link2, title: "Link", active: editor.isActive("link"), act: setLink },
  ];
  const blocks: { icon: LucideIcon; title: string; active: boolean; act: () => void }[] = [
    { icon: Heading2, title: "Heading", active: editor.isActive("heading", { level: 2 }), act: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { icon: List, title: "Bulleted list", active: editor.isActive("bulletList"), act: () => editor.chain().focus().toggleBulletList().run() },
    { icon: ListOrdered, title: "Numbered list", active: editor.isActive("orderedList"), act: () => editor.chain().focus().toggleOrderedList().run() },
    { icon: Quote, title: "Quote", active: editor.isActive("blockquote"), act: () => editor.chain().focus().toggleBlockquote().run() },
  ];

  const visible = pos !== null || mode !== "bar";
  if (!visible || !pos) {
    return error ? <ErrorToast message={error} onClose={() => setError(null)} /> : null;
  }

  const button = (b: { icon: LucideIcon; title: string; active: boolean; act: () => void }) => (
    <button key={b.title} type="button" title={b.title} aria-label={b.title} aria-pressed={b.active} onMouseDown={(e) => e.preventDefault()} onClick={b.act} className={cn(BTN, b.active && BTN_ON)}>
      <b.icon size={15} />
    </button>
  );

  return (
    <>
      <div ref={box} style={{ top: pos.top, left: pos.left, width: mode === "bar" ? undefined : WIDTH, maxWidth: "calc(100vw - 16px)" }} className="fixed z-40" onMouseDown={(e) => mode === "bar" && e.preventDefault()}>
        <div className="flex w-fit max-w-full flex-wrap items-center gap-0.5 rounded-lg border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          {fmt.map(button)}
          <span className="mx-0.5 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
          {blocks.map(button)}
          <span className="mx-0.5 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (mode === "bar" ? openMenu("ai") : close())}
            aria-expanded={mode !== "bar"}
            className={cn(
              "flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
              mode !== "bar" ? "bg-orange-600 text-white" : "bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-500/10 dark:text-orange-400 dark:hover:bg-orange-500/20",
            )}
          >
            {running ? <Loader size={13} /> : <Sparkles size={13} />}
            AI
            <ChevronDown size={12} className={cn("transition-transform", mode !== "bar" && "rotate-180")} />
          </button>
        </div>

        {mode !== "bar" && (
          <div className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            {mode === "prompt" ? (
              <div className="flex items-center gap-2 px-1.5 py-1">
                <PencilLine size={15} className="shrink-0 text-zinc-500 dark:text-zinc-400" />
                <input
                  ref={promptInput}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && promptValue.trim()) {
                      e.preventDefault();
                      void run({ kind: "custom", prompt: promptValue.trim() }, "Rewriting…");
                    } else if (e.key === "Escape") {
                      setMode("ai");
                    }
                  }}
                  disabled={running}
                  placeholder="How should AI change the selection?"
                  className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
                />
                {running ? (
                  <Loader size={15} className="text-orange-500" />
                ) : (
                  <button type="button" aria-label="Run" onClick={() => promptValue.trim() && void run({ kind: "custom", prompt: promptValue.trim() }, "Rewriting…")} className="rounded bg-orange-600 p-1 text-white hover:bg-orange-500">
                    <CornerDownLeft size={13} />
                  </button>
                )}
                <button type="button" aria-label="Back" onClick={() => setMode("ai")} className="rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <MenuRow icon={PencilLine} label="Edit with a prompt…" accent onClick={() => setMode("prompt")} />
                <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                {AI_ITEMS.map((item) => (
                  <MenuRow key={item.label} icon={item.icon} label={item.label} disabled={running} onClick={() => void run(item.run, `${item.label}…`)} />
                ))}
                <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                <p className="px-2 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">Change tone</p>
                <div className="flex flex-wrap gap-1 px-1.5 pb-1.5">
                  {TONES.map((tone) => (
                    <Chip key={tone} disabled={running} onClick={() => void run({ kind: "transform", action: "tone", tone: tone.toLowerCase() }, `Making it ${tone.toLowerCase()}…`)}>
                      {tone}
                    </Chip>
                  ))}
                </div>
                <p className="flex items-center gap-1 px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  <Languages size={11} /> Translate
                </p>
                <div className="flex flex-wrap gap-1 px-1.5 pb-1">
                  {LANGUAGES.map((language) => (
                    <Chip key={language} disabled={running} onClick={() => void run({ kind: "transform", action: "translate", language }, `Translating to ${language}…`)}>
                      {language.replace(" (Brazilian)", "")}
                    </Chip>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {error && <ErrorToast message={error} onClose={() => setError(null)} />}
    </>
  );
}

function MenuRow({ icon: Icon, label, onClick, accent, disabled }: { icon: LucideIcon; label: string; onClick: () => void; accent?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800",
        accent ? "font-medium text-orange-600 dark:text-orange-400" : "text-zinc-700 dark:text-zinc-200",
      )}
    >
      <Icon size={15} className={accent ? "" : "text-zinc-500 dark:text-zinc-400"} />
      {label}
    </button>
  );
}

function Chip({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 transition-colors hover:border-orange-300 hover:text-orange-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-orange-500/50 dark:hover:text-orange-400"
    >
      {children}
    </button>
  );
}

function ErrorToast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <span className="pointer-events-auto flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white shadow-lg">
        {message}
        <button type="button" onClick={onClose} aria-label="Dismiss">
          <X size={13} />
        </button>
      </span>
    </div>
  );
}
