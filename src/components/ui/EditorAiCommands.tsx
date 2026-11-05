"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ArrowRight, BookOpen, CornerDownLeft, Maximize2, Minimize2, Scissors, Sparkles, WandSparkles, X } from "lucide-react";
import { Loader } from "@/components/prompt-kit/loader";
import { cn } from "@/lib/cn";

type Command = {
  id: string;
  label: string;
  hint: string;
  icon: typeof Sparkles;
  // "prompt": open an input (write / ask); "run": execute immediately.
  run: "prompt-write" | "prompt-ask" | "continue" | ("improve" | "fix-grammar" | "shorten" | "lengthen");
};

const BASE_COMMANDS: Command[] = [
  { id: "write", label: "Write", hint: "Generate content from a prompt", icon: Sparkles, run: "prompt-write" },
  { id: "continue", label: "Continue writing", hint: "Pick up where the text ends", icon: ArrowRight, run: "continue" },
  { id: "improve", label: "Improve", hint: "Rewrite and polish the whole note", icon: WandSparkles, run: "improve" },
  { id: "fix", label: "Fix grammar", hint: "Correct spelling and grammar", icon: Scissors, run: "fix-grammar" },
  { id: "shorten", label: "Make shorter", hint: "Tighten the note", icon: Minimize2, run: "shorten" },
  { id: "lengthen", label: "Make longer", hint: "Expand with more detail", icon: Maximize2, run: "lengthen" },
];

const ASK_COMMAND: Command = { id: "ask", label: "Ask the docs", hint: "Answer from this project's documents", icon: BookOpen, run: "prompt-ask" };

type Pos = { top: number; left: number };
type Prompt = { kind: "write" | "ask" | "custom"; selection?: { from: number; to: number } } & Pos;

function caretPos(editor: Editor): Pos {
  const { from } = editor.state.selection;
  const c = editor.view.coordsAtPos(from);
  return { top: c.bottom + 4, left: c.left };
}

/**
 * Slash commands and inline AI for the rich editor. Type "/" for a command menu (write, continue, ask the docs,
 * improve, …); some open a prompt box that writes AI content into the note. Selecting text shows an "AI edit" button
 * that rewrites the selection from an instruction. Mounted inside RichTextEditor; `onBusy` dims the editor while running.
 */
export function EditorAiCommands({ editor, projectId, onBusy }: { editor: Editor; projectId?: string; onBusy: (label: string | null) => void }) {
  const commands = projectId ? [BASE_COMMANDS[0], BASE_COMMANDS[1], ASK_COMMAND, ...BASE_COMMANDS.slice(2)] : BASE_COMMANDS;

  const [menu, setMenu] = useState<(Pos & { query: string }) | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bubble, setBubble] = useState<Pos | null>(null);
  const promptInput = useRef<HTMLInputElement>(null);

  const filtered = menu ? commands.filter((c) => c.label.toLowerCase().replace(/\s/g, "").includes(menu.query.toLowerCase())) : [];

  const closeMenu = useCallback(() => setMenu(null), []);

  // Detect a trailing "/word" at the cursor to open the command menu; show the selection bubble otherwise.
  useEffect(() => {
    function update() {
      const { state } = editor;
      const { from, empty } = state.selection;
      if (!empty) {
        const c = editor.view.coordsAtPos(from);
        setBubble({ top: c.top - 38, left: c.left });
        setMenu(null);
        return;
      }
      setBubble(null);
      const $from = state.selection.$from;
      const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "￼");
      const match = /(?:^|\s)\/([a-zA-Z]*)$/.exec(before);
      if (match && prompt === null) {
        setMenu({ ...caretPos(editor), query: match[1] });
        setHighlight(0);
      } else {
        setMenu(null);
      }
    }
    editor.on("selectionUpdate", update);
    editor.on("update", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("update", update);
    };
  }, [editor, prompt]);

  // Keyboard nav while the menu is open.
  useEffect(() => {
    if (!menu) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[highlight];
        if (cmd) choose(cmd);
      } else if (e.key === "Escape") {
        closeMenu();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, filtered, highlight]);

  useEffect(() => {
    if (prompt) promptInput.current?.focus();
  }, [prompt]);

  /** Removes the trailing "/query" that opened the menu. Returns the caret position for anchoring a prompt box. */
  function clearSlash(): Pos {
    const pos = caretPos(editor);
    const $from = editor.state.selection.$from;
    const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "￼");
    const match = /\/([a-zA-Z]*)$/.exec(before);
    if (match) {
      const start = editor.state.selection.from - match[0].length;
      editor.chain().focus().deleteRange({ from: start, to: editor.state.selection.from }).run();
    }
    return pos;
  }

  const currentMarkdown = () => editor.storage.markdown.getMarkdown() as string;

  function appendMarkdown(md: string) {
    const current = currentMarkdown().trimEnd();
    editor.commands.setContent(current ? `${current}\n\n${md}` : md);
    editor.commands.focus("end");
  }

  async function runTransform(action: string) {
    onBusy("Working on your note…");
    setError(null);
    try {
      const res = await fetch("/api/ai/transform-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: currentMarkdown(), action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "The AI tool is unavailable.");
        return;
      }
      editor.commands.setContent(body.text ?? "");
      editor.commands.focus("end");
    } catch {
      setError("Network error — please try again.");
    } finally {
      onBusy(null);
    }
  }

  async function runContinue() {
    const text = currentMarkdown();
    if (!text.trim()) {
      setError("Write something first, then continue.");
      return;
    }
    onBusy("Continuing…");
    setError(null);
    try {
      const res = await fetch("/api/ai/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "continue", text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body.error ?? "The AI tool is unavailable.");
      else appendMarkdown(body.text ?? "");
    } catch {
      setError("Network error — please try again.");
    } finally {
      onBusy(null);
    }
  }

  function choose(cmd: Command) {
    const pos = clearSlash();
    closeMenu();
    if (cmd.run === "prompt-write") {
      setPromptValue("");
      setPrompt({ kind: "write", ...pos });
    } else if (cmd.run === "prompt-ask") {
      setPromptValue("");
      setPrompt({ kind: "ask", ...pos });
    } else if (cmd.run === "continue") {
      void runContinue();
    } else {
      void runTransform(cmd.run);
    }
  }

  async function submitPrompt() {
    if (!prompt || running) return;
    const value = promptValue.trim();
    if (!value) return;
    setRunning(true);
    setError(null);
    onBusy(prompt.kind === "ask" ? "Searching the documents…" : "Writing…");
    try {
      if (prompt.kind === "ask" && projectId) {
        const res = await fetch(`/api/projects/${projectId}/assistant`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: value }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) setError(body.error ?? "The assistant is unavailable.");
        else appendMarkdown(body.answer ?? "");
      } else if (prompt.kind === "custom" && prompt.selection) {
        const { from, to } = prompt.selection;
        const selected = editor.state.doc.textBetween(from, to, "\n");
        const res = await fetch("/api/ai/compose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "custom", prompt: value, text: selected }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) setError(body.error ?? "The AI tool is unavailable.");
        else editor.chain().focus().insertContentAt({ from, to }, body.text ?? "").run();
      } else {
        const res = await fetch("/api/ai/compose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "write", prompt: value, text: currentMarkdown() }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) setError(body.error ?? "The AI tool is unavailable.");
        else appendMarkdown(body.text ?? "");
      }
      setPrompt(null);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setRunning(false);
      onBusy(null);
    }
  }

  function openSelectionPrompt() {
    const { from, to } = editor.state.selection;
    const pos = caretPos(editor);
    setPromptValue("");
    setBubble(null);
    setPrompt({ kind: "custom", selection: { from, to }, top: pos.top, left: pos.left });
  }

  const promptPlaceholder = prompt?.kind === "ask" ? "Ask about this project's documents…" : prompt?.kind === "custom" ? "How should AI change the selection?" : "Describe what to write…";

  return (
    <>
      {/* Selection → AI edit button */}
      {bubble && !prompt && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            openSelectionPrompt();
          }}
          style={{ top: bubble.top, left: bubble.left }}
          className="fixed z-40 inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white shadow-lg hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          <WandSparkles size={12} /> AI edit
        </button>
      )}

      {/* Slash command menu */}
      {menu && filtered.length > 0 && (
        <div style={{ top: menu.top, left: menu.left }} className="fixed z-40 w-64 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              type="button"
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(cmd);
              }}
              className={cn("flex w-full items-center gap-2.5 px-3 py-1.5 text-left", i === highlight ? "bg-zinc-100 dark:bg-zinc-800" : "")}
            >
              <cmd.icon size={15} className="shrink-0 text-orange-500" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">{cmd.label}</span>
                <span className="block truncate text-xs text-zinc-400">{cmd.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Prompt box for write / ask / custom */}
      {prompt && (
        <div style={{ top: prompt.top, left: prompt.left }} className="fixed z-50 w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-orange-300 bg-white p-2 shadow-xl dark:border-orange-500/40 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="shrink-0 text-orange-500" />
            <input
              ref={promptInput}
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submitPrompt();
                } else if (e.key === "Escape") {
                  setPrompt(null);
                }
              }}
              placeholder={promptPlaceholder}
              disabled={running}
              className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
            />
            {running ? (
              <Loader size={15} className="text-orange-500" />
            ) : (
              <button type="button" onMouseDown={(e) => { e.preventDefault(); void submitPrompt(); }} aria-label="Run" className="rounded bg-orange-600 p-1 text-white hover:bg-orange-500">
                <CornerDownLeft size={13} />
              </button>
            )}
            <button type="button" onMouseDown={(e) => { e.preventDefault(); setPrompt(null); }} aria-label="Cancel" className="rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
              <X size={14} />
            </button>
          </div>
          {prompt.kind === "custom" && <p className="mt-1 pl-6 text-[11px] text-zinc-400">Rewrites the selected text.</p>}
        </div>
      )}

      {error && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
          <span className="pointer-events-auto flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white shadow-lg">
            {error}
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
              <X size={13} />
            </button>
          </span>
        </div>
      )}
    </>
  );
}
