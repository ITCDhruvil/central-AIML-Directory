"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import type { Slice } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ChartColumn,
  Code,
  Copy,
  Download,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  MoveHorizontal,
  PanelTopClose,
  Plus,
  Quote,
  Search,
  Sparkles,
  Trash2,
  Type,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { exportCsv, fitAllColumns } from "@/components/ui/tableOps";

type Active = { pos: number; top: number; left: number };
type Item = { id: string; label: string; icon: LucideIcon; group: string; run: () => void; danger?: boolean; toggle?: boolean; on?: boolean; keep?: boolean };

const TEXT_BLOCKS = new Set(["paragraph", "heading", "bulletList", "orderedList", "taskList", "blockquote", "codeBlock"]);

/** ProseMirror reads the dragged slice from view.dragging when the drop lands. */
function setDragging(editor: Editor, value: { slice: Slice; move: boolean } | null) {
  editor.view.dragging = value;
}

/** The top-level block (and its start position) at a document position, or null. */
function blockAt(editor: Editor, pos: number, inside = -1): number | null {
  const { doc } = editor.state;
  const p = Math.max(0, Math.min(inside >= 0 ? inside : pos, doc.content.size));
  const $p = doc.resolve(p);
  const start = $p.depth >= 1 ? $p.before(1) : p;
  return doc.nodeAt(start) ? start : null;
}

/**
 * Notion-style block controls: a "+" (add a block below and open the command menu) and a six-dot grip (drag to move the
 * block; click to select it and open an actions menu: turn into, duplicate, move, delete, ask AI, and table tools).
 * The handle follows the block under the pointer, or the block the cursor is in.
 */
export function BlockHandle({ editor }: { editor: Editor }) {
  const [active, setActive] = useState<Active | null>(null);
  const [menu, setMenu] = useState<{ top: number; left: number; maxH: number } | null>(null);
  const [query, setQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [, setTick] = useState(0);
  const locked = useRef(false);
  useEffect(() => {
    locked.current = menu !== null;
  }, [menu]);

  const place = useCallback(
    (pos: number | null) => {
      if (pos === null || !editor.isEditable) return setActive(null);
      const dom = editor.view.nodeDOM(pos);
      if (!(dom instanceof HTMLElement)) return setActive(null);
      const rect = dom.getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(dom).lineHeight);
      const line = Number.isFinite(lh) ? lh : 22;
      const isTable = editor.state.doc.nodeAt(pos)?.type.name === "table";
      setActive((prev) => {
        const next = { pos, top: rect.top + (isTable ? 6 : Math.max(0, line / 2 - 12)), left: rect.left - 52 };
        return prev && prev.pos === next.pos && Math.abs(prev.top - next.top) < 0.5 && Math.abs(prev.left - next.left) < 0.5 ? prev : next;
      });
    },
    [editor],
  );

  // Follow the pointer over the editor, and the cursor when the document or selection changes.
  useEffect(() => {
    const dom = editor.view.dom;
    const onMove = (e: MouseEvent) => {
      if (locked.current) return;
      const box = dom.getBoundingClientRect();
      const hit = editor.view.posAtCoords({ left: Math.max(e.clientX, box.left + 70), top: e.clientY });
      if (hit) place(blockAt(editor, hit.pos, hit.inside));
    };
    const onCursor = () => {
      if (locked.current) return;
      place(blockAt(editor, editor.state.selection.from));
    };
    const reposition = () => setActive((a) => (a ? (place(a.pos), a) : a));
    dom.addEventListener("mousemove", onMove);
    editor.on("selectionUpdate", onCursor);
    editor.on("update", onCursor);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      dom.removeEventListener("mousemove", onMove);
      editor.off("selectionUpdate", onCursor);
      editor.off("update", onCursor);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [editor, place]);

  // The menu closes on a click elsewhere or Escape.
  useEffect(() => {
    if (!menu) return;
    searchRef.current?.focus();
    const bump = () => setTick((n) => n + 1);
    editor.on("transaction", bump);
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      editor.off("transaction", bump);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, editor]);

  const node = active ? editor.state.doc.nodeAt(active.pos) : null;

  /** Puts the cursor inside the block so the editor's own commands act on it. */
  function enter(pos: number) {
    const n = editor.state.doc.nodeAt(pos);
    if (!n) return;
    const sel = n.isAtom ? NodeSelection.create(editor.state.doc, pos) : TextSelection.near(editor.state.doc.resolve(pos + 1));
    editor.view.dispatch(editor.state.tr.setSelection(sel));
  }

  function addBelow() {
    if (!active || !node) return;
    const empty = node.type.name === "paragraph" && node.content.size === 0;
    if (empty) {
      editor.chain().focus().setTextSelection(active.pos + 1).insertContent("/").run();
      return;
    }
    const end = active.pos + node.nodeSize;
    editor.chain().focus().insertContentAt(end, { type: "paragraph" }).setTextSelection(end + 1).insertContent("/").run();
  }

  function openMenu() {
    if (!active) return;
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, active.pos)));
    setQuery("");
    // Open below the block so the text stays visible; flip above when the space below is too small.
    const el = editor.view.nodeDOM(active.pos);
    const rect = el instanceof HTMLElement ? el.getBoundingClientRect() : { top: active.top, bottom: active.top + 24, left: active.left + 56 };
    const below = window.innerHeight - rect.bottom - 14;
    const above = rect.top - 14;
    const useBelow = below >= 260 || below >= above;
    const maxH = Math.max(180, Math.min(416, useBelow ? below : above));
    setMenu({
      top: useBelow ? rect.bottom + 6 : Math.max(8, rect.top - 6 - maxH),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 272)),
      maxH,
    });
  }

  function onDragStart(e: React.DragEvent) {
    if (!active) return;
    const { view } = editor;
    const sel = NodeSelection.create(view.state.doc, active.pos);
    view.dispatch(view.state.tr.setSelection(sel));
    const slice = sel.content();
    const { dom, text } = view.serializeForClipboard(slice);
    e.dataTransfer.clearData();
    e.dataTransfer.setData("text/html", dom.innerHTML);
    e.dataTransfer.setData("text/plain", text);
    e.dataTransfer.effectAllowed = "copyMove";
    const el = view.nodeDOM(active.pos);
    if (el instanceof HTMLElement) e.dataTransfer.setDragImage(el, 0, 0);
    setDragging(editor, { slice, move: true });
  }

  const items = useMemo<Item[]>(() => {
    if (!active || !node) return [];
    const pos = active.pos;
    const size = node.nodeSize;
    const name = node.type.name;
    const turn = (run: (c: ReturnType<Editor["chain"]>) => void) => () => {
      enter(pos);
      run(editor.chain().focus().clearNodes());
    };
    const list: Item[] = [];
    if (TEXT_BLOCKS.has(name)) {
      list.push(
        { id: "text", label: "Text", icon: Type, group: "Turn into", run: turn((c) => c.run()) },
        { id: "h1", label: "Heading 1", icon: Heading1, group: "Turn into", run: turn((c) => c.setHeading({ level: 1 }).run()) },
        { id: "h2", label: "Heading 2", icon: Heading2, group: "Turn into", run: turn((c) => c.setHeading({ level: 2 }).run()) },
        { id: "h3", label: "Heading 3", icon: Heading3, group: "Turn into", run: turn((c) => c.setHeading({ level: 3 }).run()) },
        { id: "bullet", label: "Bulleted list", icon: List, group: "Turn into", run: turn((c) => c.toggleBulletList().run()) },
        { id: "number", label: "Numbered list", icon: ListOrdered, group: "Turn into", run: turn((c) => c.toggleOrderedList().run()) },
        { id: "todo", label: "To-do list", icon: ListTodo, group: "Turn into", run: turn((c) => c.toggleTaskList().run()) },
        { id: "quote", label: "Quote", icon: Quote, group: "Turn into", run: turn((c) => c.toggleBlockquote().run()) },
        { id: "code", label: "Code block", icon: Code, group: "Turn into", run: turn((c) => c.toggleCodeBlock().run()) },
      );
    }
    if (name === "table") {
      const header = node.firstChild?.firstChild?.type.name === "tableHeader";
      list.push(
        { id: "header", label: "Header row", icon: PanelTopClose, group: "Table", toggle: true, on: header, keep: true, run: () => (enter(pos), editor.chain().focus().toggleHeaderRow().run()) },
        { id: "fit", label: "Fit columns to content", icon: MoveHorizontal, group: "Table", run: () => (enter(pos), fitAllColumns(editor, "content")) },
        { id: "even", label: "Make columns even", icon: ArrowLeftRight, group: "Table", run: () => (enter(pos), fitAllColumns(editor, "even")) },
        { id: "csv", label: "Export as CSV", icon: Download, group: "Table", run: () => (enter(pos), exportCsv(editor)) },
        { id: "chart", label: "Chart with AI", icon: ChartColumn, group: "Table", run: () => editor.view.dom.dispatchEvent(new CustomEvent("chart-ai", { detail: { pos: pos + size } })) },
      );
    }
    if (TEXT_BLOCKS.has(name) || name === "table") {
      list.push({
        id: "ai",
        label: "Ask AI to edit",
        icon: Sparkles,
        group: "AI",
        run: () => editor.view.dom.dispatchEvent(new CustomEvent("block-ai", { detail: { from: pos, to: pos + size, top: menu?.top ?? 120, left: menu?.left ?? 120 } })),
      });
    }
    const $pos = editor.state.doc.resolve(pos);
    list.push(
      { id: "dup", label: "Duplicate", icon: Copy, group: "Block", run: () => void editor.chain().focus().insertContentAt(pos + size, node.toJSON()).run() },
      {
        id: "up",
        label: "Move up",
        icon: ArrowUp,
        group: "Block",
        keep: true,
        run: () => {
          const prev = $pos.nodeBefore;
          if (!prev) return;
          const tr = editor.state.tr.delete(pos, pos + size).insert(pos - prev.nodeSize, node);
          editor.view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, pos - prev.nodeSize)));
        },
      },
      {
        id: "down",
        label: "Move down",
        icon: ArrowDown,
        group: "Block",
        keep: true,
        run: () => {
          const next = editor.state.doc.nodeAt(pos + size);
          if (!next) return;
          const tr = editor.state.tr.delete(pos, pos + size).insert(pos + next.nodeSize, node);
          editor.view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, pos + next.nodeSize)));
        },
      },
      { id: "del", label: "Delete", icon: Trash2, group: "Block", danger: true, run: () => void editor.chain().focus().deleteRange({ from: pos, to: pos + size }).run() },
    );
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, node, menu, editor]);

  const shown = query.trim() ? items.filter((i) => i.label.toLowerCase().includes(query.trim().toLowerCase())) : items;
  const groups = [...new Set(shown.map((i) => i.group))];

  if (!active) return null;
  return (
    <>
      <div style={{ top: active.top, left: active.left }} className="fixed z-30 hidden items-center gap-0.5 sm:flex">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addBelow}
          aria-label="Add a block below"
          title="Click to add a block below"
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          draggable
          onDragStart={onDragStart}
          onDragEnd={() => setDragging(editor, null)}
          onClick={openMenu}
          aria-label="Drag to move, click for options"
          title="Drag to move · click for options"
          className="flex h-6 w-5 cursor-grab items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <GripVertical size={16} />
        </button>
      </div>

      {menu && (
        <div
          ref={menuRef}
          style={{ top: menu.top, left: menu.left, maxHeight: menu.maxH }}
          className="fixed z-50 flex w-64 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="p-2">
            <div className="flex items-center gap-2 rounded-lg border-2 border-blue-500/70 px-2 py-1.5">
              <Search size={14} className="text-zinc-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search actions…"
                className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
            {groups.length === 0 && <p className="px-2 py-3 text-sm text-zinc-400">No matching actions</p>}
            {groups.map((g, gi) => (
              <div key={g} className={cn(gi > 0 && "mt-1 border-t border-zinc-100 pt-1 dark:border-zinc-800")}>
                <p className="px-2 pb-0.5 pt-1 text-[11px] font-medium text-zinc-400">{g}</p>
                {shown
                  .filter((i) => i.group === g)
                  .map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => {
                        i.run();
                        if (i.keep) place(blockAt(editor, editor.state.selection.from));
                        else setMenu(null);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        i.danger ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
                      )}
                    >
                      <i.icon size={15} className={i.danger ? "" : "text-zinc-500 dark:text-zinc-400"} />
                      <span className="flex-1">{i.label}</span>
                      {i.toggle && (
                        <span className={cn("flex h-4 w-7 items-center rounded-full p-0.5 transition-colors", i.on ? "bg-blue-500" : "bg-zinc-300 dark:bg-zinc-600")}>
                          <span className={cn("h-3 w-3 rounded-full bg-white transition-transform", i.on && "translate-x-3")} />
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
