"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Extension } from "@tiptap/core";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { ResizableImage } from "@/components/ui/ResizableImage";
import { Markdown } from "tiptap-markdown";
import {
  Bold,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Code,
  Code2,
  Heading,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Image as ImageIcon,
  Pilcrow,
  Table2,
  Trash2,
  Heart,
  Italic,
  Languages,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  Palette,
  Quote,
  Redo2,
  RemoveFormatting,
  Smile,
  Sparkles,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ListIndentIncrease,
  ListIndentDecrease,
  Search,
  SpellCheck2,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Underline as UnderlineIcon,
  Undo2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { TextShimmer } from "@/components/prompt-kit/text-shimmer";
import { cn } from "@/lib/cn";
import { cleanPastedHtml } from "@/lib/cleanPastedHtml";
import { EditorAiCommands } from "@/components/ui/EditorAiCommands";
import { SelectionToolbar } from "@/components/ui/SelectionToolbar";
import { GhostText } from "@/components/ui/GhostText";
import { ChartPreview } from "@/components/ui/ChartPreview";
import { TableAutoFit } from "@/components/ui/tableOps";
import { BlockHandle } from "@/components/ui/BlockHandle";
import { BlockExtensions } from "@/components/ui/BlockExtensions";
import { ColorTools } from "@/components/ui/ColorTools";
import { AlignedHeading, AlignedParagraph, Highlight, TextColor, ALIGNMENTS, type Alignment } from "@/components/ui/ColorMarks";
import { FindBar } from "@/components/ui/FindBar";
import { FindReplace } from "@/components/ui/FindReplace";
import { MentionMenu } from "@/components/ui/MentionMenu";
import { EditorStatusBar, MoreMenu, type MoreEntry } from "@/components/ui/EditorExtras";
import { Media } from "@/components/ui/MediaExtension";
import { MediaDialog } from "@/components/ui/MediaDialog";
import type { MediaKind } from "@/lib/media";
import { useClickOutside } from "@/lib/useClickOutside";
import {
  TEXT_TRANSFORM_LANGUAGES,
  type TextTransformAction,
  type TextTransformLanguage,
  type TextTransformTone,
} from "@/lib/ai/textTransformPrompts";

/** The shortcuts shown in an empty editor, so they can be found without a manual. */
export const EDITOR_HINT = "Space for AI · / for commands · @ to mention";

/** Matches MarkdownView's rendered look (src/components/MarkdownView.tsx) so what you type looks like what gets shown elsewhere. */
const EDITOR_CLASSES = [
  "min-h-24 px-3 sm:pl-[4.5rem] py-2 text-sm leading-relaxed text-zinc-900 focus:outline-none dark:text-zinc-100",
  "[&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-lg [&_h1]:font-semibold",
  "[&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-base [&_h2]:font-semibold",
  "[&_h3]:mt-2.5 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold",
  "[&_h4]:mt-2 [&_h4]:mb-1 [&_h4]:text-sm [&_h4]:font-medium",
  "[&_h5]:mt-2 [&_h5]:mb-0.5 [&_h5]:text-xs [&_h5]:font-semibold",
  "[&_h6]:mt-2 [&_h6]:mb-0.5 [&_h6]:text-xs [&_h6]:font-medium",
  "[&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_a]:text-orange-600 [&_a]:underline dark:[&_a]:text-orange-400",
  "[&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs dark:[&_code]:bg-zinc-800",
  "[&_pre]:my-2 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-zinc-100 [&_pre]:p-2.5 [&_pre]:text-xs dark:[&_pre]:bg-zinc-800",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-500 dark:[&_blockquote]:border-zinc-700",
  "[&_hr]:my-3 [&_hr]:border-zinc-200 dark:[&_hr]:border-zinc-800",
  // Tables: a soft rounded frame, light row lines, a tinted header, a hover row, and a visible column-drag handle.
  "[&_.tableWrapper]:my-3 [&_.tableWrapper]:overflow-x-auto [&_.tableWrapper]:rounded-xl [&_.tableWrapper]:border [&_.tableWrapper]:border-zinc-200 dark:[&_.tableWrapper]:border-zinc-700/70",
  // Once columns have fixed widths (dragged or fitted) the frame shrinks to the table instead of staying full width.
  "[&_.tableWrapper:has([colwidth])]:w-fit [&_.tableWrapper:has([colwidth])]:max-w-full",
  "[&_table]:w-full [&_table]:border-separate [&_table]:border-spacing-0 [&_table]:text-left [&_table]:text-sm",
  "[&_th]:relative [&_th]:border-b [&_th]:border-zinc-200 [&_th]:bg-zinc-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-[13px] [&_th]:font-semibold [&_th]:text-zinc-600 dark:[&_th]:border-zinc-700/70 dark:[&_th]:bg-zinc-800/60 dark:[&_th]:text-zinc-300",
  "[&_td]:relative [&_td]:border-b [&_td]:border-zinc-100 [&_td]:px-3 [&_td]:py-2 dark:[&_td]:border-zinc-800",
  "[&_th+th]:border-l [&_th+th]:border-l-zinc-100 [&_td+td]:border-l [&_td+td]:border-l-zinc-100 dark:[&_th+th]:border-l-zinc-800 dark:[&_td+td]:border-l-zinc-800",
  "[&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:hover_td]:bg-zinc-50/80 dark:[&_tbody_tr:hover_td]:bg-zinc-800/30",
  "[&_td_p]:my-0 [&_th_p]:my-0",
  "[&_.selectedCell]:bg-orange-500/10",
  "[&_.column-resize-handle]:absolute [&_.column-resize-handle]:top-0 [&_.column-resize-handle]:right-[-3px] [&_.column-resize-handle]:bottom-0 [&_.column-resize-handle]:z-10 [&_.column-resize-handle]:w-[3px] [&_.column-resize-handle]:rounded-full [&_.column-resize-handle]:bg-orange-500",
  "[&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-md",
  "[&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0",
  "[&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:items-start [&_ul[data-type=taskList]_li]:gap-2",
  "[&_ul[data-type=taskList]_li>label]:mt-1 [&_ul[data-type=taskList]_li>div]:flex-1",
  "[&_sub]:align-sub [&_sub]:text-[0.75em] [&_sup]:align-super [&_sup]:text-[0.75em]",
  "[&_.is-empty::before]:pointer-events-none [&_.is-empty::before]:float-left [&_.is-empty::before]:h-0 [&_.is-empty::before]:text-zinc-400 [&_.is-empty::before]:content-[attr(data-placeholder)] dark:[&_.is-empty::before]:text-zinc-500",
].join(" ");

const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);

function shortcutLabel(parts: string[]): string {
  return parts
    .map((part) => {
      if (part === "Mod") return IS_MAC ? "⌘" : "Ctrl";
      if (part === "Shift") return IS_MAC ? "⇧" : "Shift";
      if (part === "Alt") return IS_MAC ? "⌥" : "Alt";
      return part;
    })
    .join(IS_MAC ? "" : "+");
}

/** Extra shortcuts that match the Format text / Lists menus (clear formatting, code, sub/super). */
const ExtraKeyboardShortcuts = Extension.create({
  name: "extraKeyboardShortcuts",
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-m": () => this.editor.commands.toggleCode(),
      "Mod-Shift-,": () => this.editor.commands.toggleSubscript(),
      "Mod-Shift-.": () => this.editor.commands.toggleSuperscript(),
      "Mod-\\": () => this.editor.chain().focus().clearNodes().unsetAllMarks().run(),
    };
  },
});

const TONE_OPTIONS: { value: TextTransformTone; label: string; icon: LucideIcon }[] = [
  { value: "professional", label: "More professional", icon: Briefcase },
  { value: "casual", label: "More casual", icon: Smile },
  { value: "confident", label: "More confident", icon: Zap },
  { value: "friendly", label: "More friendly", icon: Heart },
];

function ToolbarButton({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded transition-colors",
        active
          ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400"
          : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <Icon size={14} />
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-800" />;
}

/** Split control (icon + chevron) that shares one hover/active background across both halves. */
function SplitToolbarGroup({
  label,
  icon: Icon,
  active,
  open,
  onOpenChange,
  children,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => onOpenChange(false), open);

  const highlighted = open || active;

  return (
    <div ref={ref} className="relative">
      <div
        className={cn(
          "flex items-stretch overflow-hidden rounded transition-colors",
          highlighted
            ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400"
            : "bg-zinc-200/80 text-zinc-500 hover:bg-zinc-300/80 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700",
        )}
      >
        <button
          type="button"
          title={label}
          aria-label={label}
          aria-expanded={open}
          aria-haspopup="menu"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onOpenChange(!open)}
          className="flex h-7 w-7 items-center justify-center"
        >
          <Icon size={14} />
        </button>
        <button
          type="button"
          title={label}
          aria-label={`${label} options`}
          aria-expanded={open}
          aria-haspopup="menu"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onOpenChange(!open)}
          className={cn(
            "flex h-7 w-5 items-center justify-center border-l",
            highlighted ? "border-orange-200/80 dark:border-orange-500/30" : "border-zinc-200/80 dark:border-zinc-700/80",
          )}
        >
          <ChevronDown size={12} />
        </button>
      </div>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-1 min-w-[15rem] overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItemWithShortcut({
  icon: Icon,
  label,
  labelClassName,
  shortcut,
  active,
  muted,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  labelClassName?: string;
  shortcut?: string;
  active?: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors",
        muted
          ? "text-zinc-400 hover:bg-zinc-50 dark:text-zinc-500 dark:hover:bg-zinc-800"
          : active
            ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
            : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800",
      )}
    >
      <Icon size={15} className="shrink-0" />
      <span className={cn("flex-1", labelClassName)}>{label}</span>
      {shortcut && (
        <kbd className="rounded bg-zinc-100 px-1.5 py-0.5 font-sans text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {shortcut}
        </kbd>
      )}
    </button>
  );
}

function FormatTextMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const markActive =
    editor.isActive("bold") ||
    editor.isActive("italic") ||
    editor.isActive("underline") ||
    editor.isActive("strike") ||
    editor.isActive("code") ||
    editor.isActive("subscript") ||
    editor.isActive("superscript");

  function run(action: () => void) {
    action();
    setOpen(false);
  }

  return (
    <SplitToolbarGroup
      label="Format text"
      icon={Bold}
      active={markActive}
      open={open}
      onOpenChange={setOpen}
    >
      <MenuItemWithShortcut
        icon={Bold}
        label="Bold"
        shortcut={shortcutLabel(["Mod", "B"])}
        active={editor.isActive("bold")}
        onClick={() => run(() => editor.chain().focus().toggleBold().run())}
      />
      <MenuItemWithShortcut
        icon={Italic}
        label="Italic"
        shortcut={shortcutLabel(["Mod", "I"])}
        active={editor.isActive("italic")}
        onClick={() => run(() => editor.chain().focus().toggleItalic().run())}
      />
      <MenuItemWithShortcut
        icon={UnderlineIcon}
        label="Underline"
        shortcut={shortcutLabel(["Mod", "U"])}
        active={editor.isActive("underline")}
        onClick={() => run(() => editor.chain().focus().toggleUnderline().run())}
      />
      <MenuItemWithShortcut
        icon={Strikethrough}
        label="Strikethrough"
        shortcut={shortcutLabel(["Mod", "Shift", "S"])}
        active={editor.isActive("strike")}
        onClick={() => run(() => editor.chain().focus().toggleStrike().run())}
      />
      <MenuItemWithShortcut
        icon={Code2}
        label="Code"
        shortcut={shortcutLabel(["Mod", "Shift", "M"])}
        active={editor.isActive("code")}
        onClick={() => run(() => editor.chain().focus().toggleCode().run())}
      />
      <MenuItemWithShortcut
        icon={SubscriptIcon}
        label="Subscript"
        shortcut={shortcutLabel(["Mod", "Shift", ","])}
        active={editor.isActive("subscript")}
        onClick={() => run(() => editor.chain().focus().toggleSubscript().run())}
      />
      <MenuItemWithShortcut
        icon={SuperscriptIcon}
        label="Superscript"
        shortcut={shortcutLabel(["Mod", "Shift", "."])}
        active={editor.isActive("superscript")}
        onClick={() => run(() => editor.chain().focus().toggleSuperscript().run())}
      />
      <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
      <MenuItemWithShortcut
        icon={RemoveFormatting}
        label="Clear formatting"
        shortcut={shortcutLabel(["Mod", "\\"])}
        muted
        onClick={() => run(() => editor.chain().focus().clearNodes().unsetAllMarks().run())}
      />
    </SplitToolbarGroup>
  );
}

function ListsMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const listActive = editor.isActive("bulletList") || editor.isActive("orderedList") || editor.isActive("taskList");

  function run(action: () => void) {
    action();
    setOpen(false);
  }

  return (
    <SplitToolbarGroup label="Lists" icon={List} active={listActive} open={open} onOpenChange={setOpen}>
      <MenuItemWithShortcut
        icon={List}
        label="Bulleted list"
        shortcut={shortcutLabel(["Mod", "Shift", "8"])}
        active={editor.isActive("bulletList")}
        onClick={() => run(() => editor.chain().focus().toggleBulletList().run())}
      />
      <MenuItemWithShortcut
        icon={ListOrdered}
        label="Numbered list"
        shortcut={shortcutLabel(["Mod", "Shift", "7"])}
        active={editor.isActive("orderedList")}
        onClick={() => run(() => editor.chain().focus().toggleOrderedList().run())}
      />
      <MenuItemWithShortcut
        icon={ListChecks}
        label="Task list"
        shortcut={shortcutLabel(["Mod", "Shift", "6"])}
        active={editor.isActive("taskList")}
        onClick={() => run(() => editor.chain().focus().toggleTaskList().run())}
      />
    </SplitToolbarGroup>
  );
}

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

const HEADING_ICONS: Record<(typeof HEADING_LEVELS)[number], LucideIcon> = {
  1: Heading1,
  2: Heading2,
  3: Heading3,
  4: Heading4,
  5: Heading5,
  6: Heading6,
};

/** Same scale the editor uses, so the menu previews the heading you will get. */
const HEADING_LABEL_CLASS: Record<(typeof HEADING_LEVELS)[number], string> = {
  1: "text-lg font-semibold leading-tight",
  2: "text-base font-semibold leading-tight",
  3: "text-sm font-semibold leading-tight",
  4: "text-sm font-medium leading-tight",
  5: "text-xs font-semibold leading-tight",
  6: "text-xs font-medium leading-tight",
};

const ALIGN_META: Record<Alignment, { label: string; icon: LucideIcon }> = {
  left: { label: "Align left", icon: AlignLeft },
  center: { label: "Align center", icon: AlignCenter },
  right: { label: "Align right", icon: AlignRight },
  justify: { label: "Justify", icon: AlignJustify },
};

function currentAlignment(editor: Editor): Alignment {
  const value = (editor.getAttributes("heading").textAlign ?? editor.getAttributes("paragraph").textAlign) as string | undefined;
  return (ALIGNMENTS as readonly string[]).includes(value ?? "") ? (value as Alignment) : "left";
}

function setAlignment(editor: Editor, align: Alignment) {
  editor.chain().focus().updateAttributes("paragraph", { textAlign: align }).updateAttributes("heading", { textAlign: align }).run();
}

function AlignMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const current = currentAlignment(editor);
  const Icon = ALIGN_META[current].icon;
  return (
    <SplitToolbarGroup label="Alignment" icon={Icon} active={current !== "left"} open={open} onOpenChange={setOpen}>
      {ALIGNMENTS.map((a) => (
        <MenuItemWithShortcut
          key={a}
          icon={ALIGN_META[a].icon}
          label={ALIGN_META[a].label}
          active={current === a}
          onClick={() => {
            setAlignment(editor, a);
            setOpen(false);
          }}
        />
      ))}
    </SplitToolbarGroup>
  );
}

function HeadingsMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const activeLevel = HEADING_LEVELS.find((level) => editor.isActive("heading", { level }));
  const Icon = activeLevel ? HEADING_ICONS[activeLevel] : Heading;

  function run(action: () => void) {
    action();
    setOpen(false);
  }

  return (
    <SplitToolbarGroup label="Headings" icon={Icon} active={activeLevel != null} open={open} onOpenChange={setOpen}>
      <MenuItemWithShortcut
        icon={Pilcrow}
        label="Paragraph"
        active={!activeLevel && editor.isActive("paragraph") && !editor.isActive("listItem")}
        onClick={() => run(() => editor.chain().focus().setParagraph().run())}
      />
      {HEADING_LEVELS.map((level) => (
        <MenuItemWithShortcut
          key={level}
          icon={HEADING_ICONS[level]}
          label={`Heading ${level}`}
          labelClassName={HEADING_LABEL_CLASS[level]}
          shortcut={shortcutLabel(["Mod", "Alt", String(level)])}
          active={activeLevel === level}
          onClick={() => run(() => editor.chain().focus().toggleHeading({ level }).run())}
        />
      ))}
    </SplitToolbarGroup>
  );
}

function TableMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const inTable = editor.isActive("table");
  const inHeader = editor.isActive("tableHeader");

  function run(action: () => void) {
    action();
    setOpen(false);
  }

  return (
    <SplitToolbarGroup label="Table" icon={Table2} active={inTable} open={open} onOpenChange={setOpen}>
      {!inTable && (
        <MenuItemWithShortcut
          icon={Table2}
          label="Insert table"
          onClick={() => run(() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
        />
      )}
      {inTable && (
        <>
          <MenuItemWithShortcut
            icon={Table2}
            label="Add row below"
            onClick={() => run(() => editor.chain().focus().addRowAfter().run())}
          />
          <MenuItemWithShortcut
            icon={Table2}
            label="Add column after"
            onClick={() => run(() => editor.chain().focus().addColumnAfter().run())}
          />
          {!inHeader && (
            <MenuItemWithShortcut
              icon={Trash2}
              label="Delete row"
              muted
              onClick={() => run(() => editor.chain().focus().deleteRow().run())}
            />
          )}
          <MenuItemWithShortcut
            icon={Trash2}
            label="Delete column"
            muted
            onClick={() => run(() => editor.chain().focus().deleteColumn().run())}
          />
          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
          <MenuItemWithShortcut
            icon={Trash2}
            label="Delete table"
            muted
            onClick={() => run(() => editor.chain().focus().deleteTable().run())}
          />
        </>
      )}
    </SplitToolbarGroup>
  );
}

function AiMenuItem({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      <Icon size={14} className="shrink-0 text-zinc-400" />
      {label}
    </button>
  );
}

/** A menu row that opens a flyout submenu to its right, on hover or click — "Change tone", "Translate", etc. */
function AiSubmenuRow({
  icon: Icon,
  label,
  panelClassName,
  children,
}: {
  icon: LucideIcon;
  label: string;
  panelClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openNow() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }
  function closeSoon() {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }

  return (
    <div className="relative" onMouseEnter={openNow} onMouseLeave={closeSoon}>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
          open ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800",
        )}
      >
        <Icon size={14} className="shrink-0 text-zinc-400" />
        <span className="flex-1">{label}</span>
        <ChevronRight size={14} className="shrink-0 text-zinc-400" />
      </button>

      {open && (
        <div
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
          className={cn(
            "absolute left-full top-0 z-30 ml-1 w-52 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900",
            panelClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** "Improve description" + a menu of other AI rewrites (fix grammar, shorten, lengthen, tone) — all opt-in, one click each, applied through the editor's own undo history. */
const BUSY_LABEL: Record<TextTransformAction, string> = {
  improve: "Improving your content…",
  "fix-grammar": "Fixing spelling and grammar…",
  shorten: "Making it shorter…",
  lengthen: "Making it longer…",
  tone: "Changing the tone…",
  translate: "Translating…",
  title: "Writing a title…",
  icons: "Finding icons…",
};

function AiMenu({ editor, onBusy }: { editor: Editor; onBusy: (label: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const isEmpty = editor.isEmpty;

  useClickOutside(ref, () => setOpen(false), open);

  async function runTransform(action: TextTransformAction, tone?: TextTransformTone, language?: TextTransformLanguage) {
    const text = editor.storage.markdown.getMarkdown();
    if (!text.trim() || loading) return;

    setOpen(false);
    setLoading(true);
    onBusy(BUSY_LABEL[action]);
    setError(null);
    try {
      const res = await fetch("/api/ai/transform-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, action, tone, language }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to update text");
        return;
      }
      editor.commands.setContent(body.text);
      editor.commands.focus("end");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
      onBusy(null);
    }
  }

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => runTransform("improve")}
        disabled={isEmpty || loading}
        className={cn(
          "flex items-center gap-1.5 rounded-l-md px-2 py-1 text-xs font-medium transition-colors",
          isEmpty || loading
            ? "cursor-not-allowed text-zinc-300 dark:text-zinc-600"
            : "text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-500/10",
        )}
      >
        <Sparkles size={14} className={loading ? "animate-pulse" : undefined} />
        {loading ? "Improving..." : "Improve description"}
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        disabled={isEmpty || loading}
        aria-label="More AI actions"
        aria-expanded={open}
        className={cn(
          "flex h-7 w-6 items-center justify-center rounded-r-md border-l border-zinc-200 dark:border-zinc-800",
          isEmpty || loading
            ? "cursor-not-allowed text-zinc-300 dark:text-zinc-600"
            : "text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-500/10",
        )}
      >
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <AiMenuItem icon={SpellCheck2} label="Fix spelling & grammar" onClick={() => runTransform("fix-grammar")} />
          <AiSubmenuRow icon={Palette} label="Change tone">
            {TONE_OPTIONS.map((opt) => (
              <AiMenuItem key={opt.value} icon={opt.icon} label={opt.label} onClick={() => runTransform("tone", opt.value)} />
            ))}
          </AiSubmenuRow>
          <AiMenuItem icon={Minimize2} label="Make shorter" onClick={() => runTransform("shorten")} />
          <AiMenuItem icon={Maximize2} label="Make longer" onClick={() => runTransform("lengthen")} />
          <AiSubmenuRow icon={Languages} label="Translate" panelClassName="max-h-72">
            {TEXT_TRANSFORM_LANGUAGES.map((lang) => (
              <AiMenuItem key={lang} icon={Languages} label={lang} onClick={() => runTransform("translate", undefined, lang)} />
            ))}
          </AiSubmenuRow>
        </div>
      )}

      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </div>
  );
}

type ToolGroup = "autocomplete" | "lists" | "headings" | "align" | "color" | "blocks" | "table" | "image" | "link" | "edit" | "history";

// The order groups stay on the toolbar as it narrows: the toolbar is filled as far as it will go, and whatever is left
// moves into the "..." menu instead of wrapping onto a second row.
const TOOL_ORDER: ToolGroup[] = ["lists", "headings", "align", "color", "autocomplete", "link", "image", "table", "blocks", "edit", "history"];
// Groups that have a divider in front of them when shown.
const DIVIDED: ToolGroup[] = ["blocks", "edit", "history"];

function promptLink(editor: Editor) {
  const previousUrl = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("Link URL", previousUrl ?? "");
  if (url === null) return;
  if (!url.trim()) {
    editor.chain().focus().unsetLink().run();
    return;
  }
  editor.chain().focus().setLink({ href: url.trim() }).run();
}

function Toolbar({
  editor,
  onBusy,
  autocomplete,
  onToggleAutocomplete,
}: {
  editor: Editor;
  onBusy: (label: string | null) => void;
  autocomplete: boolean;
  onToggleAutocomplete: () => void;
}) {
  const [mediaKind, setMediaKind] = useState<MediaKind | null>(null);
  const [width, setWidth] = useState(1200);
  // Real measured widths: of the always-shown parts, and of each optional group (measured in a hidden copy).
  const [sizes, setSizes] = useState<{ fixed: number; groups: Partial<Record<ToolGroup, number>> } | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const aiRef = useRef<HTMLDivElement>(null);
  const fmtRef = useRef<HTMLDivElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  // The slash menu (/image, /video, /audio) asks the toolbar to open the same dialog.
  useEffect(() => {
    const dom = editor.view.dom;
    const open = (e: Event) => setMediaKind((e as CustomEvent<{ kind: MediaKind }>).detail?.kind ?? "image");
    dom.addEventListener("open-media", open);
    return () => dom.removeEventListener("open-media", open);
  }, [editor]);

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Measure once the pieces are on screen (before paint), and again if the autocomplete button changes size.
  useLayoutEffect(() => {
    const groups: Partial<Record<ToolGroup, number>> = {};
    mirror.current?.querySelectorAll<HTMLElement>("[data-group]").forEach((el) => {
      groups[el.dataset.group as ToolGroup] = el.getBoundingClientRect().width;
    });
    // Always shown: the AI menu, the bold group, the "..." button (28) and the first divider (about 10).
    const fixed = (aiRef.current?.getBoundingClientRect().width ?? 190) + (fmtRef.current?.getBoundingClientRect().width ?? 52) + 28 + 10;
    setSizes({ fixed, groups });
  }, [autocomplete]);

  // Fill the toolbar as far as it goes, in priority order; the rest goes into the "..." menu.
  const shown = new Set<ToolGroup>();
  if (!sizes) TOOL_ORDER.forEach((g) => shown.add(g));
  else {
    let used = sizes.fixed + 12;
    for (const g of TOOL_ORDER) {
      const w = (sizes.groups[g] ?? 30) + 2 + (DIVIDED.includes(g) ? 10 : 0);
      if (used + w > width) break;
      used += w;
      shown.add(g);
    }
  }
  const inList = editor.isActive("listItem") || editor.isActive("taskItem");
  const chain = () => editor.chain().focus();
  const indent = () => editor.chain().focus().sinkListItem(editor.isActive("taskItem") ? "taskItem" : "listItem").run();
  const outdent = () => editor.chain().focus().liftListItem(editor.isActive("taskItem") ? "taskItem" : "listItem").run();

  const text: MoreEntry[] = [];
  if (!shown.has("autocomplete")) text.push({ icon: Zap, label: `Autocomplete: ${autocomplete ? "on" : "off"}`, keep: true, run: onToggleAutocomplete });
  if (!shown.has("lists")) {
    text.push(
      { icon: List, label: "Bulleted list", run: () => chain().toggleBulletList().run() },
      { icon: ListOrdered, label: "Numbered list", run: () => chain().toggleOrderedList().run() },
      { icon: ListChecks, label: "To-do list", run: () => chain().toggleTaskList().run() },
    );
  }
  if (!shown.has("align")) {
    ALIGNMENTS.forEach((a) => text.push({ icon: ALIGN_META[a].icon, label: ALIGN_META[a].label, keep: true, run: () => setAlignment(editor, a) }));
  }
  if (!shown.has("headings")) {
    text.push(
      { icon: Pilcrow, label: "Normal text", run: () => chain().setParagraph().run() },
      { icon: Heading1, label: "Heading 1", run: () => chain().toggleHeading({ level: 1 }).run() },
      { icon: Heading2, label: "Heading 2", run: () => chain().toggleHeading({ level: 2 }).run() },
      { icon: Heading3, label: "Heading 3", run: () => chain().toggleHeading({ level: 3 }).run() },
    );
  }
  const insert: MoreEntry[] = [];
  if (!shown.has("blocks")) {
    insert.push(
      { icon: Quote, label: "Quote", run: () => chain().toggleBlockquote().run() },
      { icon: Code, label: "Code block", run: () => chain().toggleCodeBlock().run() },
      { icon: Minus, label: "Divider", run: () => chain().setHorizontalRule().run() },
    );
  }
  if (!shown.has("table")) insert.push({ icon: Table2, label: "Insert table", run: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() });
  if (!shown.has("image")) insert.push({ icon: ImageIcon, label: "Image, video or audio", run: () => setMediaKind("image") });
  if (!shown.has("link")) insert.push({ icon: Link2, label: "Link", run: () => promptLink(editor) });
  const edit: MoreEntry[] = [];
  if (!shown.has("edit")) {
    edit.push(
      { icon: ListIndentIncrease, label: "Indent list item", run: () => void (inList && indent()) },
      { icon: ListIndentDecrease, label: "Outdent list item", run: () => void (inList && outdent()) },
      { icon: RemoveFormatting, label: "Clear formatting", run: () => chain().unsetAllMarks().clearNodes().run() },
      { icon: Search, label: "Find and replace", run: () => editor.view.dom.dispatchEvent(new CustomEvent("open-find")) },
    );
  }
  if (!shown.has("history")) {
    edit.push(
      { icon: Undo2, label: "Undo", run: () => chain().undo().run() },
      { icon: Redo2, label: "Redo", run: () => chain().redo().run() },
    );
  }
  const extra = [
    ...(!shown.has("color") ? [{ title: "Colors", items: [] as MoreEntry[], node: <ColorTools editor={editor} /> }] : []),
    { title: "Text", items: text },
    { title: "Insert", items: insert },
    { title: "Edit", items: edit },
  ].filter((g) => g.items.length > 0 || g.node);

  // The optional groups, used both on the toolbar and in the hidden copy that is measured.
  const groupNodes: Record<ToolGroup, React.ReactNode> = {
    autocomplete: (
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onToggleAutocomplete}
        title="AI autocomplete: suggests the rest as grey text; press Tab to accept"
        aria-pressed={autocomplete}
        className={cn(
          "ml-1 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
          autocomplete
            ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
            : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
        )}
      >
        <Zap size={14} />
        Autocomplete
      </button>
    ),
    lists: <ListsMenu editor={editor} />,
    headings: <HeadingsMenu editor={editor} />,
    align: <AlignMenu editor={editor} />,
    color: <ColorTools editor={editor} />,
    blocks: (
      <>
        <ToolbarButton label="Quote" icon={Quote} active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <ToolbarButton label="Code block" icon={Code} active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
        <ToolbarButton label="Divider" icon={Minus} onClick={() => editor.chain().focus().setHorizontalRule().run()} />
      </>
    ),
    table: <TableMenu editor={editor} />,
    image: <ToolbarButton label="Image, video or audio" icon={ImageIcon} active={editor.isActive("image") || editor.isActive("media")} onClick={() => setMediaKind("image")} />,
    link: <ToolbarButton label="Link" icon={Link2} active={editor.isActive("link")} onClick={() => promptLink(editor)} />,
    edit: (
      <>
        <ToolbarButton label="Indent list item" icon={ListIndentIncrease} disabled={!inList} onClick={indent} />
        <ToolbarButton label="Outdent list item" icon={ListIndentDecrease} disabled={!inList} onClick={outdent} />
        <ToolbarButton label="Clear formatting" icon={RemoveFormatting} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} />
        <ToolbarButton label="Find and replace (Ctrl F)" icon={Search} onClick={() => editor.view.dom.dispatchEvent(new CustomEvent("open-find"))} />
      </>
    ),
    history: (
      <>
        <ToolbarButton label="Undo" icon={Undo2} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} />
        <ToolbarButton label="Redo" icon={Redo2} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} />
      </>
    ),
  };
  const show = (g: ToolGroup, divider = false) =>
    shown.has(g) ? (
      <>
        {divider && <ToolbarDivider />}
        {groupNodes[g]}
      </>
    ) : null;

  return (
    <div ref={bar} className="relative z-20 flex flex-nowrap items-center gap-0.5 rounded-t-md border-b border-zinc-200 bg-zinc-50 px-1.5 py-1 dark:border-zinc-800 dark:bg-zinc-950">
      {mediaKind && <MediaDialog editor={editor} initialKind={mediaKind} onClose={() => setMediaKind(null)} />}
      <div ref={aiRef} className="shrink-0">
        <AiMenu editor={editor} onBusy={onBusy} />
      </div>
      {show("autocomplete")}

      <ToolbarDivider />

      <div ref={fmtRef} className="flex shrink-0 items-center">
        <FormatTextMenu editor={editor} />
      </div>
      {show("lists")}
      {show("headings")}
      {show("align")}
      {show("color")}

      {show("blocks", true)}
      {show("table")}
      {show("image")}
      {show("link")}
      {show("edit", true)}
      {show("history", true)}
      <MoreMenu editor={editor} extra={extra} />

      {/* A hidden copy of every optional group, only so its real width can be measured. */}
      <div ref={mirror} aria-hidden inert className="pointer-events-none invisible absolute left-0 top-0 flex items-center gap-0.5 whitespace-nowrap">
        {TOOL_ORDER.map((g) => (
          <div key={g} data-group={g} className="flex shrink-0 items-center">
            {groupNodes[g]}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A small on-theme rich text editor (Tiptap) that reads and writes plain
 * Markdown — the value/onChange contract is a Markdown string, same as
 * every other text field in the app, so storage and safe rendering
 * elsewhere (MarkdownView) don't change. Never stores or emits raw HTML.
 */
/** The status phrases shown one after another while the AI works, so the wait feels alive. */
function statusPhrases(label: string): string[] {
  const l = label.toLowerCase();
  if (l.startsWith("writing")) return ["Thinking\u2026", "Drafting\u2026", "Writing\u2026", "Polishing\u2026"];
  if (l.startsWith("editing")) return ["Reading it\u2026", "Editing\u2026", "Polishing\u2026"];
  if (l.startsWith("searching")) return ["Searching the documents\u2026", "Reading the sources\u2026", "Writing the answer\u2026"];
  if (l.startsWith("continuing")) return ["Reading what you wrote\u2026", "Continuing\u2026", "Polishing\u2026"];
  if (l.startsWith("building")) return ["Reading the table\u2026", "Choosing a chart\u2026", "Building the chart\u2026"];
  return ["Thinking\u2026", label, "Polishing\u2026"];
}

/** A single shimmering status line ("Writing…") right where the AI content is about to appear. */
function AiWritingSkeleton({ editor, label, pos }: { editor: Editor; label: string; pos?: number }) {
  const [at, setAt] = useState<{ top: number; left: number; width: number } | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const phrases = statusPhrases(label);
  const [step, setStep] = useState(0);
  useEffect(() => {
    // Move on every couple of seconds and stay on the last phrase until the AI finishes.
    const timer = setInterval(() => setStep((n) => Math.min(n + 1, phrases.length - 1)), 2200);
    return () => clearInterval(timer);
  }, [phrases.length]);
  useEffect(() => {
    const parent = holder.current?.parentElement;
    if (!parent) return;
    const box = parent.getBoundingClientRect();
    const pm = editor.view.dom as HTMLElement;
    const pmBox = pm.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(pm).paddingLeft) || 12;
    const size = editor.state.doc.content.size;
    // Rewriting the whole note starts at the top; otherwise it appears right below the anchor.
    const node = pos !== undefined && pos >= 0 ? editor.state.doc.nodeAt(pos) : null;
    if (node && node.type.name === "paragraph" && node.content.size === 0) {
      // An empty line: the status text sits exactly where the placeholder was.
      const c = editor.view.coordsAtPos(pos! + 1);
      setAt({ top: c.top - box.top, left: c.left - box.left, width: pmBox.width - pad - 16 });
      return;
    }
    const top =
      pos === undefined
        ? 12
        : editor.view.coordsAtPos(Math.max(1, Math.min(pos < 0 ? size - 1 : pos + 1, size))).bottom - box.top + 10;
    setAt({ top: Math.max(8, top), left: pmBox.left - box.left + pad, width: pmBox.width - pad - 16 });
  }, [editor, pos]);

  return (
    <div ref={holder} role="status" aria-live="polite" className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {at && (
        <div style={{ top: at.top, left: at.left, width: at.width }} className="absolute">
          <TextShimmer key={step} className="ai-phrase text-sm font-medium">{phrases[step]}</TextShimmer>
        </div>
      )}
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  projectId,
}: {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  /** When set, slash commands include "Ask the docs" (RAG over this project's documents). */
  projectId?: string;
}) {
  // Set while an AI action is rewriting the text: shows the status over the text area and blocks typing meanwhile.
  const [busy, setBusyState] = useState<{ label: string; pos?: number } | null>(null);
  // `pos` is where the result will land (-1 = end of the note); without it the whole note is being rewritten.
  const setBusy = useCallback((label: string | null, pos?: number) => setBusyState(label ? { label, pos } : null), []);
  // Opt-in inline AI autocomplete (grey suggestions; Tab to accept).
  const [autocomplete, setAutocomplete] = useState(false);

  const editor = useEditor({
    extensions: [
      // StarterKit v3 bundles link and underline; they are registered separately below with our options.
      StarterKit.configure({ paragraph: false, heading: false, link: false, underline: false }),
      // Paragraphs and headings that remember their alignment, plus text colour and highlight (see ColorMarks.ts).
      AlignedParagraph,
      AlignedHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
      TextColor,
      Highlight,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      ResizableImage,
      Underline,
      Subscript,
      Superscript,
      ExtraKeyboardShortcuts,
      GhostText,
      ChartPreview,
      ...BlockExtensions,
      FindReplace,
      Media,
      TableAutoFit,
      Link.configure({ openOnClick: false, autolink: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: ({ editor: ed, node }) =>
          node.type.name === "heading"
            ? `Heading ${node.attrs.level}`
            : ed.state.doc.childCount === 1 && ed.state.doc.firstChild?.content.size === 0 && placeholder
              ? placeholder
              : EDITOR_HINT,
      }),
      Markdown.configure({ html: true, transformCopiedText: true, transformPastedText: true }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: EDITOR_CLASSES },
      transformPastedHTML: (html) => cleanPastedHtml(html),
    },
    onUpdate: ({ editor }) => {
      onChange(editor.storage.markdown.getMarkdown());
    },
  });

  // Reflect external changes (e.g. an AI-fill or undo elsewhere in the form) without fighting the user's own typing.
  useEffect(() => {
    if (!editor) return;
    const current = editor.storage.markdown.getMarkdown();
    if (value !== current) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!busy);
  }, [busy, editor]);

  return (
    <div className={cn("flex flex-col rounded-md border border-zinc-300 dark:border-zinc-700", className)}>
      {editor && <Toolbar editor={editor} onBusy={setBusy} autocomplete={autocomplete} onToggleAutocomplete={() => setAutocomplete((v) => !v)} />}
      {editor && <EditorAiCommands editor={editor} projectId={projectId} onBusy={setBusy} autocomplete={autocomplete} />}
      {editor && <BlockHandle editor={editor} />}
      {editor && <MentionMenu editor={editor} />}
      {editor && <SelectionToolbar editor={editor} onBusy={setBusy} />}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <EditorContent
          editor={editor}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto transition-opacity [&_.ProseMirror]:min-h-[12rem] [&_.ProseMirror]:h-full",
            busy && busy.pos === undefined && "opacity-40",
            // The status text takes the placeholder's place while the AI is working.
            busy && "[&_.is-empty::before]:opacity-0",
          )}
        />
        {editor && <FindBar editor={editor} />}
        {busy && editor && <AiWritingSkeleton editor={editor} label={busy.label} pos={busy.pos} />}
      </div>
      {editor && <EditorStatusBar editor={editor} />}
    </div>
  );
}
