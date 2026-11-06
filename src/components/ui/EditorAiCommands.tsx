"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  ChartColumn,
  ChevronDown,
  ChartLine,
  ChartPie,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  CalendarDays,
  ClipboardList,
  CornerDownLeft,
  Flag,
  ListChecks,
  Maximize2,
  Minimize2,
  Scissors,
  Sparkles,
  PanelTopClose,
  Rows3,
  Columns3,
  Table2,
  TableCellsMerge,
  TableCellsSplit,
  Target,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Loader } from "@/components/prompt-kit/loader";
import { CHART_LANG, parseChartSpec, serializeChartSpec, tableToChartSpec, type ChartSpec, type ChartType } from "@/lib/chartSpec";
import { ghostTextKey } from "@/components/ui/GhostText";
import { cn } from "@/lib/cn";

type Command = {
  id: string;
  label: string;
  hint: string;
  icon: typeof Sparkles;
  // The action to run; see choose(). Prefixes: "note:" (note-tools), "tmpl:" (insert a template).
  run: string;
};

const BASE_COMMANDS: Command[] = [
  { id: "write", label: "Write", hint: "Generate content from a prompt", icon: Sparkles, run: "prompt-write" },
  { id: "continue", label: "Continue writing", hint: "Pick up where the text ends", icon: ArrowRight, run: "continue" },
  { id: "table", label: "Table", hint: "Generate a table from a prompt", icon: Table2, run: "prompt-table" },
  { id: "chart-bar", label: "Table \u2192 Bar chart", hint: "Turn the nearest table into a bar chart", icon: ChartColumn, run: "chart:bar" },
  { id: "chart-line", label: "Table \u2192 Line chart", hint: "Turn the nearest table into a line chart", icon: ChartLine, run: "chart:line" },
  { id: "chart-pie", label: "Table \u2192 Pie chart", hint: "Turn the nearest table into a pie chart", icon: ChartPie, run: "chart:pie" },
  { id: "chart-ai", label: "Chart from prompt", hint: "Describe the data; AI builds the chart", icon: Sparkles, run: "prompt-chart" },
  { id: "summarize", label: "Summarize", hint: "Add a short summary of the note", icon: ClipboardList, run: "note:summarize" },
  { id: "actions", label: "Action items", hint: "Extract a to-do checklist", icon: ListChecks, run: "note:action-items" },
  { id: "improve", label: "Improve", hint: "Rewrite and polish the whole note", icon: WandSparkles, run: "improve" },
  { id: "fix", label: "Fix grammar", hint: "Correct spelling and grammar", icon: Scissors, run: "fix-grammar" },
  { id: "shorten", label: "Make shorter", hint: "Tighten the note", icon: Minimize2, run: "shorten" },
  { id: "lengthen", label: "Make longer", hint: "Expand with more detail", icon: Maximize2, run: "lengthen" },
  { id: "tmpl-meeting", label: "Template: Meeting notes", hint: "Insert a meeting-notes skeleton", icon: CalendarDays, run: "tmpl:meeting" },
  { id: "tmpl-standup", label: "Template: Standup", hint: "Insert a standup skeleton", icon: CalendarDays, run: "tmpl:standup" },
  { id: "tmpl-decision", label: "Template: Decision", hint: "Insert a decision-record skeleton", icon: Flag, run: "tmpl:decision" },
  { id: "tmpl-prd", label: "Template: PRD", hint: "Insert a product-requirements skeleton", icon: Target, run: "tmpl:prd" },
];

const TEMPLATES: Record<string, string> = {
  meeting: "## Meeting notes\n\n**Date:** \n**Attendees:** \n\n### Agenda\n- \n\n### Discussion\n- \n\n### Decisions\n- \n\n### Action items\n- [ ] ",
  standup: "## Standup\n\n**Yesterday**\n- \n\n**Today**\n- \n\n**Blockers**\n- ",
  decision: "## Decision\n\n**Context**\n\n**Options considered**\n- \n\n**Decision**\n\n**Why**\n\n**Owner / date:** ",
  prd: "# PRD\n\n## Problem\n\n## Goals\n- \n\n## Non-goals\n- \n\n## Requirements\n- \n\n## Success metrics\n- \n\n## Open questions\n- ",
};

const ASK_COMMAND: Command = { id: "ask", label: "Ask the docs", hint: "Answer from this project's documents", icon: BookOpen, run: "prompt-ask" };

type Pos = { top: number; left: number };
type Prompt = { kind: "write" | "ask" | "table" | "chart" } & Pos;

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
export function EditorAiCommands({
  editor,
  projectId,
  onBusy,
  autocomplete = false,
}: {
  editor: Editor;
  projectId?: string;
  onBusy: (label: string | null) => void;
  /** When true, inline AI autocomplete suggests a continuation as grey text after a typing pause. */
  autocomplete?: boolean;
}) {
  const commands = projectId ? [BASE_COMMANDS[0], BASE_COMMANDS[1], ASK_COMMAND, ...BASE_COMMANDS.slice(2)] : BASE_COMMANDS;

  const [menu, setMenu] = useState<(Pos & { query: string }) | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableBar, setTableBar] = useState<Pos | null>(null);
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  const tableBox = useRef<HTMLDivElement>(null);
  const promptInput = useRef<HTMLInputElement>(null);
  const highlightedItem = useRef<HTMLButtonElement>(null);

  const filtered = menu ? commands.filter((c) => c.label.toLowerCase().replace(/\s/g, "").includes(menu.query.toLowerCase())) : [];
  const grid = menu ? /^(\d{1,2})x(\d{1,2})$/i.exec(menu.query) : null;
  const items: Command[] = grid
    ? [{ id: "grid", label: `Insert ${grid[1]}\u00d7${grid[2]} table`, hint: `${grid[1]} columns \u00d7 ${grid[2]} rows`, icon: Table2, run: `grid:${grid[1]}:${grid[2]}` }]
    : filtered;

  const closeMenu = useCallback(() => setMenu(null), []);

  // Detect a trailing "/word" at the cursor to open the command menu; show the selection bubble otherwise.
  useEffect(() => {
    function update() {
      const { state } = editor;
      const { empty } = state.selection;
      if (!empty) {
        setMenu(null);
        return;
      }
      const $from = state.selection.$from;
      const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "￼");
      const match = /(?:^|\s)\/([a-zA-Z0-9]*)$/.exec(before);
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

  // A floating toolbar above the table when the cursor is inside one.
  useEffect(() => {
    function compute() {
      if (!editor.isActive("table")) {
        setTableBar(null);
        setTableMenuOpen(false);
        return;
      }
      const node = editor.view.domAtPos(editor.state.selection.from).node;
      const el = (node instanceof HTMLElement ? node : node.parentElement) ?? null;
      const table = el?.closest("table");
      if (!table) {
        setTableBar(null);
        return;
      }
      const r = table.getBoundingClientRect();
      setTableBar({ top: r.top > 56 ? r.top - 40 : r.bottom + 6, left: r.left });
    }
    compute();
    editor.on("selectionUpdate", compute);
    editor.on("update", compute);
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      editor.off("selectionUpdate", compute);
      editor.off("update", compute);
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [editor]);

  // The table menu closes on a click elsewhere, Escape, or when the cursor leaves the table.
  useEffect(() => {
    if (!tableMenuOpen) return;
    function onDown(e: MouseEvent) {
      if (tableBox.current && !tableBox.current.contains(e.target as Node)) setTableMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setTableMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [tableMenuOpen]);

  // Keyboard nav while the menu is open.
  useEffect(() => {
    if (!menu) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = items[highlight];
        if (cmd) choose(cmd);
      } else if (e.key === "Escape") {
        closeMenu();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, items, highlight]);

  useEffect(() => {
    if (prompt) promptInput.current?.focus();
  }, [prompt]);

  useEffect(() => {
    highlightedItem.current?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  // Inline autocomplete: after an ~800ms typing pause, ask for a short continuation and show it as grey ghost text.
  useEffect(() => {
    if (!autocomplete) return;
    let timer: number | undefined;
    let controller: AbortController | null = null;

    async function suggest() {
      const { state } = editor;
      const sel = state.selection;
      if (!editor.isFocused || !sel.empty || menu || prompt) return;
      const $from = sel.$from;
      if ($from.parentOffset !== $from.parent.content.size) return; // only at the end of a block
      if ($from.parent.type.name === "codeBlock") return;
      const blockText = $from.parent.textContent;
      if (blockText.trim().length < 2) return;
      if (ghostTextKey.getState(state)) return; // one already showing
      const md = editor.storage.markdown.getMarkdown() as string;
      if (md.length > 6000) return; // cost guard
      const fromAtRequest = sel.from;
      controller?.abort();
      controller = new AbortController();
      try {
        const res = await fetch("/api/ai/compose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "complete", text: md.slice(-1200) }),
          signal: controller.signal,
        });
        if (!res.ok) return;
        const body = await res.json().catch(() => ({}));
        let text = String(body.text ?? "")
          .replace(/^\s+/, "")
          .split("\n")[0]
          .replace(/^[#>*\-\s]+/, "")
          .trim();
        if (!text) return;
        if (text.length > 120) text = `${text.slice(0, 120)}…`;
        const suggestion = (/\s$/.test(blockText) || blockText.length === 0 ? "" : " ") + text;
        // Only show it if the cursor hasn't moved since the request.
        const live = editor.state.selection;
        if (live.empty && live.from === fromAtRequest && !ghostTextKey.getState(editor.state)) {
          editor.commands.setGhostText(suggestion);
        }
      } catch {
        // aborted or network error — ignore
      }
    }

    function schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void suggest(), 450);
    }

    editor.on("update", schedule);
    return () => {
      window.clearTimeout(timer);
      controller?.abort();
      editor.off("update", schedule);
      editor.commands.clearGhostText();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autocomplete, editor]);

  /** Removes the trailing "/query" that opened the menu. Returns the caret position for anchoring a prompt box. */
  function clearSlash(): Pos {
    const pos = caretPos(editor);
    const $from = editor.state.selection.$from;
    const before = $from.parent.textBetween(0, $from.parentOffset, "\n", "￼");
    const match = /\/([a-zA-Z0-9]*)$/.exec(before);
    if (match) {
      const start = editor.state.selection.from - match[0].length;
      editor.chain().focus().deleteRange({ from: start, to: editor.state.selection.from }).run();
    }
    return pos;
  }

  const currentMarkdown = () => editor.storage.markdown.getMarkdown() as string;

  type FoundTable = { node: PMNode; pos: number };

  /** The table the cursor is in, else the nearest one above the cursor, else the last table in the note. */
  function targetTable(): FoundTable | null {
    const { state } = editor;
    const { $from } = state.selection;
    for (let d = $from.depth; d > 0; d -= 1) {
      if ($from.node(d).type.name === "table") return { node: $from.node(d), pos: $from.before(d) };
    }
    const found: { before: FoundTable | null; last: FoundTable | null } = { before: null, last: null };
    state.doc.descendants((node, pos) => {
      if (node.type.name !== "table") return true;
      found.last = { node, pos };
      if (pos + node.nodeSize <= $from.pos) found.before = { node, pos };
      return false;
    });
    return found.before ?? found.last;
  }

  function tableRows(table: PMNode): { rows: string[][]; hasHeader: boolean } {
    const rows: string[][] = [];
    let hasHeader = false;
    table.forEach((row, _offset, index) => {
      const cells: string[] = [];
      row.forEach((cell) => {
        cells.push(cell.textContent.trim());
        if (index === 0 && cell.type.name === "tableHeader") hasHeader = true;
      });
      rows.push(cells);
    });
    return { rows, hasHeader };
  }

  /** Puts a ```chart block right after the table (replacing one already there, so re-charting updates it). */
  function insertChartAfter(table: FoundTable, spec: ChartSpec) {
    const end = table.pos + table.node.nodeSize;
    const next = editor.state.doc.nodeAt(end);
    const block = { type: "codeBlock", attrs: { language: CHART_LANG }, content: [{ type: "text", text: serializeChartSpec(spec) }] };
    const replacing = next !== null && next.type.name === "codeBlock" && next.attrs.language === CHART_LANG;
    // A chart at the very end of the note needs a paragraph after it, so there is somewhere to keep typing.
    const content = next === null ? [block, { type: "paragraph" }] : block;
    editor
      .chain()
      .focus()
      .insertContentAt(replacing && next ? { from: end, to: end + next.nodeSize } : end, content)
      .run();
  }

  function chartFromTable(type: ChartType) {
    const table = targetTable();
    if (!table) {
      setError("Add a table first (for example type /3x4), then chart it.");
      return;
    }
    const { rows, hasHeader } = tableRows(table.node);
    const result = tableToChartSpec(rows, type, hasHeader);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    insertChartAfter(table, result.spec);
  }

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

  async function runNote(action: string) {
    const text = currentMarkdown();
    if (!text.trim()) {
      setError("Write something first, then use AI.");
      return;
    }
    onBusy("Working on your note\u2026");
    setError(null);
    try {
      const res = await fetch("/api/ai/note-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text }),
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
    } else if (cmd.run === "prompt-table") {
      setPromptValue("");
      setPrompt({ kind: "table", ...pos });
    } else if (cmd.run === "prompt-chart") {
      setPromptValue("");
      setPrompt({ kind: "chart", ...pos });
    } else if (cmd.run.startsWith("chart:")) {
      chartFromTable(cmd.run.slice(6) as ChartType);
    } else if (cmd.run === "continue") {
      void runContinue();
    } else if (cmd.run.startsWith("note:")) {
      void runNote(cmd.run.slice(5));
    } else if (cmd.run.startsWith("tmpl:")) {
      appendMarkdown(TEMPLATES[cmd.run.slice(5)] ?? "");
    } else if (cmd.run.startsWith("grid:")) {
      const [, c, r] = cmd.run.split(":");
      editor.chain().focus().insertTable({ rows: Number(r), cols: Number(c), withHeaderRow: true }).run();
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
      } else if (prompt.kind === "chart") {
        const res = await fetch("/api/ai/compose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "write",
            prompt:
              `Create a chart specification for: ${value}.\n` +
              'Return ONLY JSON in exactly this shape and nothing else: {"type":"bar"|"line"|"pie","title":string,"labels":string[],"series":[{"name":string,"data":number[]}]}.\n' +
              'Use the exact numbers if I gave any; otherwise invent plausible sample values and end the title with " (sample data)". ' +
              'Pick the chart type that fits ("bar" if unsure). Every series needs one number per label.',
            text: "",
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.error ?? "The AI tool is unavailable.");
        } else {
          const spec = parseChartSpec(String(body.text ?? "").replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, ""));
          if (spec) appendMarkdown("```" + CHART_LANG + "\n" + serializeChartSpec(spec) + "\n```");
          else setError("The AI didn't return a usable chart. Try describing the data differently.");
        }
      } else if (prompt.kind === "table") {
        const res = await fetch("/api/ai/compose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "write", prompt: `Create a Markdown table for: ${value}. Output only the table.`, text: "" }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) setError(body.error ?? "The AI tool is unavailable.");
        else appendMarkdown(body.text ?? "");
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

  type TableItem = { icon: typeof Sparkles; label: string; act: () => void; danger?: boolean; closes?: boolean };
  const tableGroups: { title: string; items: TableItem[] }[] = [
    {
      title: "Rows",
      items: [
        { icon: ArrowUp, label: "Insert row above", act: () => editor.chain().focus().addRowBefore().run() },
        { icon: ArrowDown, label: "Insert row below", act: () => editor.chain().focus().addRowAfter().run() },
        { icon: Rows3, label: "Delete row", danger: true, act: () => editor.chain().focus().deleteRow().run() },
      ],
    },
    {
      title: "Columns",
      items: [
        { icon: ArrowLeft, label: "Insert column left", act: () => editor.chain().focus().addColumnBefore().run() },
        { icon: ArrowRight, label: "Insert column right", act: () => editor.chain().focus().addColumnAfter().run() },
        { icon: Columns3, label: "Delete column", danger: true, act: () => editor.chain().focus().deleteColumn().run() },
      ],
    },
    {
      title: "Cells",
      items: [
        { icon: TableCellsMerge, label: "Merge cells", act: () => editor.chain().focus().mergeCells().run() },
        { icon: TableCellsSplit, label: "Split cell", act: () => editor.chain().focus().splitCell().run() },
        { icon: PanelTopClose, label: "Toggle header row", act: () => editor.chain().focus().toggleHeaderRow().run() },
      ],
    },
    {
      title: "Chart",
      items: [
        { icon: ChartColumn, label: "Bar chart", closes: true, act: () => chartFromTable("bar") },
        { icon: ChartLine, label: "Line chart", closes: true, act: () => chartFromTable("line") },
        { icon: ChartPie, label: "Pie chart", closes: true, act: () => chartFromTable("pie") },
      ],
    },
    { title: "", items: [{ icon: Trash2, label: "Delete table", danger: true, closes: true, act: () => editor.chain().focus().deleteTable().run() }] },
  ];

  const promptPlaceholder =
    prompt?.kind === "ask"
      ? "Ask about this project's documents…"
      : prompt?.kind === "table"
        ? "What should the table contain?"
        : prompt?.kind === "chart"
          ? "Describe the chart, e.g. monthly signups in 2026 as a line chart"
          : "Describe what to write…";

  return (
    <>
      {/* Table tools: a "Table" pill above the table that opens a labelled vertical menu */}
      {tableBar && !prompt && (
        <div ref={tableBox} style={{ top: tableBar.top, left: tableBar.left }} className="fixed z-40">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setTableMenuOpen((v) => !v)}
            aria-expanded={tableMenuOpen}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium shadow-lg transition-colors",
              tableMenuOpen
                ? "border-orange-300 bg-orange-50 text-orange-600 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-400"
                : "border-zinc-200 bg-white text-zinc-700 hover:text-orange-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
            )}
          >
            <Table2 size={14} /> Table
            <ChevronDown size={12} className={cn("transition-transform", tableMenuOpen && "rotate-180")} />
          </button>
          {tableMenuOpen && (
            <div style={{ maxHeight: "min(70vh, 26rem)" }} className="mt-1.5 w-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
              {tableGroups.map((group, gi) => (
                <div key={gi} className={cn(gi > 0 && "mt-1 border-t border-zinc-100 pt-1 dark:border-zinc-800")}>
                  {group.title && <p className="px-2 pb-0.5 pt-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">{group.title}</p>}
                  {group.items.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        item.act();
                        if (item.closes) setTableMenuOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        item.danger
                          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
                      )}
                    >
                      <item.icon size={15} className={item.danger ? "" : "text-orange-500"} />
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Slash command menu */}
      {menu && items.length > 0 && (
        <div style={{ top: menu.top, left: menu.left }} className="fixed z-40 max-h-72 w-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          {items.map((cmd, i) => (
            <button
              key={cmd.id}
              type="button"
              ref={i === highlight ? highlightedItem : null}
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
