"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import {
  AlertCircle,
  AtSign,
  ClipboardCopy,
  Ellipsis,
  FileDown,
  Info,
  Keyboard,
  Lightbulb,
  ListTree,
  OctagonAlert,
  Play,
  Printer,
  ChevronRight,
  TriangleAlert,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { cn } from "@/lib/cn";
import { textStats } from "@/lib/textStats";
import { embedSource } from "@/lib/embed";
import { insertBlock, insertEmbed, type BlockKind } from "@/components/ui/blockInsert";
import { useClickOutside } from "@/lib/useClickOutside";

// ---------------------------------------------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------------------------------------------

type DocCounts = {
  headings: number; lists: number; listItems: number; todos: number; todosDone: number; tables: number; quotes: number; dividers: number;
  codeBlocks: number; inlineCode: number; charts: number; diagrams: number;
  images: number; videos: number; audios: number; embeds: number; links: number; mentions: number;
  callouts: number; toggles: number;
};

/** Counts what the note is made of (blocks, media, links), walking the document once. */
function docCounts(doc: PMNode): DocCounts {
  const c: DocCounts = {
    headings: 0, lists: 0, listItems: 0, todos: 0, todosDone: 0, tables: 0, quotes: 0, dividers: 0,
    codeBlocks: 0, inlineCode: 0, charts: 0, diagrams: 0, images: 0, videos: 0, audios: 0, embeds: 0, links: 0, mentions: 0,
    callouts: 0, toggles: 0,
  };
  doc.descendants((node, _pos, parent) => {
    switch (node.type.name) {
      case "heading": c.headings++; break;
      case "bulletList":
      case "orderedList":
      case "taskList":
        // Only top-level lists; a list inside a list item belongs to its parent.
        if (parent && parent.type.name !== "listItem" && parent.type.name !== "taskItem") c.lists++;
        break;
      case "listItem": c.listItems++; break;
      case "taskItem":
        c.listItems++;
        c.todos++;
        if (node.attrs.checked) c.todosDone++;
        break;
      case "table": c.tables++; break;
      case "blockquote": c.quotes++; break;
      case "horizontalRule": c.dividers++; break;
      case "callout": c.callouts++; break;
      case "toggle": c.toggles++; break;
      case "codeBlock":
        if (node.attrs.language === "chart") c.charts++;
        else if (node.attrs.language === "mermaid") c.diagrams++;
        else c.codeBlocks++;
        break;
      case "image": c.images++; break;
      case "media": if (node.attrs.kind === "video") c.videos++; else c.audios++; break;
      case "embed": c.embeds++; break;
    }
    if (node.isText) {
      const marks = node.marks.map((m) => m.type.name);
      if (marks.includes("code")) c.inlineCode++;
      const mention = (node.text ?? "").startsWith("@");
      if (marks.includes("link")) {
        if (mention) c.mentions++;
        else c.links++;
      } else if (mention && marks.includes("bold")) c.mentions++;
    }
  });
  return c;
}

const minutesLabel = (m: number) => (m === 0 ? "\u2014" : m === 1 ? "1 min" : `${m} min`);
const n = (v: number) => v.toLocaleString();

/** A clean list of every count, titles on the left and numbers on the right. */
function StatsDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const { doc, selection } = editor.state;
  const text = doc.textBetween(0, doc.content.size, "\n", " ");
  const t = textStats(text);
  const c = docCounts(doc);
  const picked = selection.empty ? null : textStats(doc.textBetween(selection.from, selection.to, "\n", " "));

  const groups: { title: string; rows: [string, string][] }[] = [
    ...(picked ? [{ title: "Selection", rows: [["Words", n(picked.words)], ["Characters", n(picked.characters)], ["Sentences", n(picked.sentences)]] as [string, string][] }] : []),
    {
      title: "Text",
      rows: [
        ["Words", n(t.words)],
        ["Characters", n(t.characters)],
        ["Characters without spaces", n(t.charactersNoSpaces)],
        ["Spaces", n(t.spaces)],
        ["Sentences", n(t.sentences)],
        ["Paragraphs", n(t.paragraphs)],
        ["Average words per sentence", t.sentences ? String(t.avgWordsPerSentence) : "\u2014"],
        ["Longest word (letters)", t.longestWord ? n(t.longestWord) : "\u2014"],
        ["Reading time", minutesLabel(t.readingMinutes)],
        ["Speaking time", minutesLabel(t.speakingMinutes)],
      ],
    },
    {
      title: "Structure",
      rows: [
        ["Headings", n(c.headings)],
        ["Lists", `${n(c.lists)} (${n(c.listItems)} ${c.listItems === 1 ? "item" : "items"})`],
        ["To-dos done", c.todos ? `${n(c.todosDone)} of ${n(c.todos)}` : "0"],
        ["Quotes", n(c.quotes)],
        ["Callouts", n(c.callouts)],
        ["Toggle sections", n(c.toggles)],
        ["Tables", n(c.tables)],
        ["Dividers", n(c.dividers)],
      ],
    },
    {
      title: "Code and diagrams",
      rows: [
        ["Code blocks", n(c.codeBlocks)],
        ["Inline code", n(c.inlineCode)],
        ["Diagrams", n(c.diagrams)],
        ["Charts", n(c.charts)],
      ],
    },
    {
      title: "Media and links",
      rows: [
        ["Images", n(c.images)],
        ["Videos", n(c.videos)],
        ["Audio clips", n(c.audios)],
        ["Embeds", n(c.embeds)],
        ["Links", n(c.links)],
        ["Mentions", n(c.mentions)],
      ],
    },
  ];

  return (
    <Modal title="Note statistics" onClose={onClose}>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">{g.title}</p>
            <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {g.rows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-1.5 text-sm">
                  <dt className="text-zinc-600 dark:text-zinc-400">{label}</dt>
                  <dd className="shrink-0 font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/**
 * The strip under the editor: a few counts that fit the width, and a "..." button that opens every count.
 * While text is selected it shows the selection's counts instead.
 */
export function EditorStatusBar({ editor }: { editor: Editor }) {
  const [, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(800);
  const [widths, setWidths] = useState<number[]>([]);
  const bar = useRef<HTMLDivElement>(null);
  const mirror = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bump = () => setTick((v) => v + 1);
    editor.on("update", bump);
    editor.on("selectionUpdate", bump);
    return () => {
      editor.off("update", bump);
      editor.off("selectionUpdate", bump);
    };
  }, [editor]);

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { doc, selection } = editor.state;
  const selecting = !selection.empty;
  const t = textStats(selecting ? doc.textBetween(selection.from, selection.to, "\n", " ") : doc.textBetween(0, doc.content.size, "\n", " "));
  const images = selecting ? 0 : docCounts(doc).images;

  const items: string[] = [
    `${n(t.words)} ${t.words === 1 ? "word" : "words"}${selecting ? " selected" : ""}`,
    `${n(t.characters)} characters`,
    ...(!selecting && t.words > 0 ? [`${t.readingMinutes} min read`] : []),
    `${n(t.sentences)} ${t.sentences === 1 ? "sentence" : "sentences"}`,
    ...(images ? [`${n(images)} ${images === 1 ? "image" : "images"}`] : []),
  ];
  // Fill the line with as many counts as really fit (measured in a hidden copy); the rest are in the dialog behind "...".
  const key = items.join("|");
  useLayoutEffect(() => {
    setWidths([...(mirror.current?.children ?? [])].map((el) => (el as HTMLElement).getBoundingClientRect().width));
  }, [key]);
  let fit = items.length;
  if (widths.length === items.length) {
    const room = width - 24 - 36; // side padding, and the "..." button with its gap
    let used = 0;
    fit = 0;
    for (const w of widths) {
      const next = used + (fit ? 12 : 0) + w;
      if (next > room) break;
      used = next;
      fit++;
    }
  }

  return (
    <div ref={bar} className="relative flex items-center gap-3 rounded-b-md border-t border-zinc-100 px-3 py-1 text-[11px] text-zinc-400 dark:border-zinc-800">
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden whitespace-nowrap">
        {items.slice(0, fit).map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div ref={mirror} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex gap-3 whitespace-nowrap">
        {items.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <button
        type="button"
        title="All counts"
        aria-label="All counts"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(true)}
        className="flex h-5 w-6 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        <Ellipsis size={14} />
      </button>
      {open && <StatsDialog editor={editor} onClose={() => setOpen(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------------------------------

const markdownOf = (editor: Editor) => editor.storage.markdown.getMarkdown() as string;

export async function copyMarkdown(editor: Editor): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(markdownOf(editor));
    return true;
  } catch {
    return false;
  }
}

export function downloadMarkdown(editor: Editor, name = "note") {
  const blob = new Blob([markdownOf(editor)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Prints the note in a hidden frame with the page's own styles, so "Save as PDF" in the print dialog gives a clean copy. */
export function exportPdf(editor: Editor) {
  const clone = (editor.view.dom as HTMLElement).cloneNode(true) as HTMLElement;
  clone.removeAttribute("contenteditable");
  clone.querySelectorAll(".find-match").forEach((el) => el.classList.remove("find-match", "find-current"));
  // Frames can't print; leave a link in their place.
  clone.querySelectorAll(".embed-block").forEach((el) => {
    const p = document.createElement("p");
    p.textContent = el.getAttribute("data-embed") ?? "";
    el.replaceWith(p);
  });

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write("<!doctype html><html><head><title>Note</title></head><body></body></html>");
  doc.close();
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => doc.head.appendChild(node.cloneNode(true)));
  const print = doc.createElement("style");
  print.textContent = "@page{margin:16mm} body{margin:0;background:#fff;color:#18181b} .ProseMirror{padding:0!important;min-height:0!important;height:auto!important} .toc-preview,.mermaid-preview,.chart-preview{break-inside:avoid} .chart-actions{display:none}";
  doc.head.appendChild(print);
  doc.body.appendChild(doc.adoptNode(clone));
  // Give the copied stylesheets a moment to apply before printing.
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 1500);
  }, 700);
}

// ---------------------------------------------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------------------------------------------

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={title} className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Paste a YouTube, Vimeo, Loom or Figma link; it is checked before anything is inserted. */
export function EmbedDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const info = useMemo(() => embedSource(link), [link]);

  function add() {
    if (!info) {
      setError("Paste a YouTube, Vimeo, Loom or Figma link.");
      return;
    }
    insertEmbed(editor, link.trim());
    onClose();
  }

  return (
    <Modal title="Embed a link" onClose={onClose}>
      <input
        autoFocus
        value={link}
        onChange={(e) => {
          setLink(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => e.key === "Enter" && add()}
        placeholder="https://www.youtube.com/watch?v=…"
        className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-orange-400 dark:border-zinc-700 text-zinc-900 placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
      />
      <p className="mt-2 text-xs text-zinc-500">Works with YouTube, Vimeo, Loom and Figma links.</p>
      {info && (
        <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700" style={{ aspectRatio: info.ratio }}>
          <iframe src={info.src} title="Preview" className="h-full w-full" loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />
        </div>
      )}
      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
          <AlertCircle size={15} /> {error}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
          Cancel
        </button>
        <button type="button" onClick={add} disabled={!info} className="rounded-lg bg-orange-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40">
          Embed
        </button>
      </div>
    </Modal>
  );
}

const SHORTCUTS: { group: string; rows: [string, string][] }[] = [
  {
    group: "Text",
    rows: [
      ["Bold", "Ctrl B"],
      ["Italic", "Ctrl I"],
      ["Underline", "Ctrl U"],
      ["Strikethrough", "Ctrl Shift S"],
      ["Inline code", "Ctrl E"],
      ["Undo / redo", "Ctrl Z / Ctrl Shift Z"],
    ],
  },
  {
    group: "Blocks",
    rows: [
      ["Heading 1 / 2 / 3", "Ctrl Alt 1 / 2 / 3"],
      ["Bulleted list", "Ctrl Shift 8"],
      ["Numbered list", "Ctrl Shift 7"],
      ["To-do list", "Ctrl Shift 9"],
      ["Quote", "Ctrl Shift B"],
      ["Code block", "Ctrl Alt C"],
      ["Indent / outdent list item", "Tab / Shift Tab"],
    ],
  },
  {
    group: "Type to start",
    rows: [
      ["Heading", "# , ## , ###  then a space"],
      ["Bulleted / numbered list", "-  or  1.  then a space"],
      ["To-do", "[ ]  then a space"],
      ["Quote / code block", ">  or  ```"],
      ["Commands menu", "/"],
      ["Ask AI on an empty line", "Space"],
      ["Mention a project, idea or document", "@"],
    ],
  },
  {
    group: "Editor",
    rows: [
      ["Find and replace", "Ctrl F"],
      ["This list", "Ctrl /"],
    ],
  },
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <div className="space-y-4">
        {SHORTCUTS.map((g) => (
          <div key={g.group}>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">{g.group}</p>
            <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {g.rows.map(([name, keys]) => (
                <div key={name} className="flex items-center justify-between gap-4 py-1.5 text-sm">
                  <dt className="text-zinc-700 dark:text-zinc-300">{name}</dt>
                  <dd className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{keys}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-zinc-500">On a Mac, use Cmd instead of Ctrl.</p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// "More" menu: extra blocks, export, help
// ---------------------------------------------------------------------------------------------------------------

export type MoreEntry = { icon: LucideIcon; label: string; run: () => void; keep?: boolean };
type Entry = MoreEntry;

export function MoreMenu({ editor, extra = [] }: { editor: Editor; extra?: { title: string; items: MoreEntry[] }[] }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [embed, setEmbed] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  // Ctrl+/ shows the shortcuts; the slash menu asks for the embed dialog through an event.
  useEffect(() => {
    const dom = editor.view.dom;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setShortcuts(true);
      }
    };
    const onEmbed = () => setEmbed(true);
    const onShortcuts = () => setShortcuts(true);
    dom.addEventListener("keydown", onKey);
    dom.addEventListener("open-embed", onEmbed);
    dom.addEventListener("open-shortcuts", onShortcuts);
    return () => {
      dom.removeEventListener("keydown", onKey);
      dom.removeEventListener("open-embed", onEmbed);
      dom.removeEventListener("open-shortcuts", onShortcuts);
    };
  }, [editor]);

  const block = (kind: BlockKind) => () => insertBlock(editor, kind);
  const groups: { title: string; items: Entry[] }[] = [
    ...extra,
    {
      title: "Add blocks",
      items: [
        { icon: Info, label: "Info callout", run: block("callout:info") },
        { icon: Lightbulb, label: "Tip callout", run: block("callout:tip") },
        { icon: TriangleAlert, label: "Warning callout", run: block("callout:warning") },
        { icon: OctagonAlert, label: "Danger callout", run: block("callout:danger") },
        { icon: ChevronRight, label: "Toggle section", run: block("toggle") },
        { icon: ListTree, label: "Table of contents", run: block("toc") },
        { icon: Play, label: "Embed video or design", run: () => setEmbed(true) },
        { icon: Workflow, label: "Diagram with AI", run: () => editor.view.dom.dispatchEvent(new CustomEvent("open-ai-prompt", { detail: { kind: "diagram" } })) },
        { icon: Workflow, label: "Diagram (write code)", run: block("mermaid") },
        { icon: AtSign, label: "Mention a project or note", run: () => editor.chain().focus().insertContent("@").run() },
      ],
    },
    {
      title: "Export",
      items: [
        {
          icon: ClipboardCopy,
          label: note === "copied" ? "Copied!" : "Copy as Markdown",
          keep: true,
          run: () =>
            void copyMarkdown(editor).then((ok) => {
              setNote(ok ? "copied" : null);
              setTimeout(() => setNote(null), 1500);
            }),
        },
        { icon: FileDown, label: "Download as Markdown", run: () => downloadMarkdown(editor) },
        { icon: Printer, label: "Export as PDF", run: () => exportPdf(editor) },
      ],
    },
    { title: "Help", items: [{ icon: Keyboard, label: "Keyboard shortcuts", run: () => setShortcuts(true) }] },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="More"
        aria-label="More"
        aria-expanded={open}
        aria-haspopup="menu"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded transition-colors",
          open ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400" : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
        )}
      >
        <Ellipsis size={15} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 max-h-[26rem] w-60 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {groups.map((g, gi) => (
            <div key={g.title} className={cn(gi > 0 && "mt-1 border-t border-zinc-100 pt-1 dark:border-zinc-800")}>
              <p className="px-3 pb-0.5 pt-1 text-[11px] font-medium text-zinc-400">{g.title}</p>
              {g.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    item.run();
                    if (!item.keep) setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <item.icon size={15} className="text-zinc-500 dark:text-zinc-400" />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {embed && <EmbedDialog editor={editor} onClose={() => setEmbed(false)} />}
      {shortcuts && <ShortcutsDialog onClose={() => setShortcuts(false)} />}
    </div>
  );
}
