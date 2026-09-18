"use client";

import { useEffect, useRef, useState } from "react";
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
import { Markdown } from "tiptap-markdown";
import {
  Bold,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Code,
  Code2,
  Heading2,
  Heading3,
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
  SpellCheck2,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Underline as UnderlineIcon,
  Undo2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { cleanPastedHtml } from "@/lib/cleanPastedHtml";
import { useClickOutside } from "@/lib/useClickOutside";
import {
  TEXT_TRANSFORM_LANGUAGES,
  type TextTransformAction,
  type TextTransformLanguage,
  type TextTransformTone,
} from "@/lib/ai/textTransformPrompts";

/** Matches MarkdownView's rendered look (src/components/MarkdownView.tsx) so what you type looks like what gets shown elsewhere. */
const EDITOR_CLASSES = [
  "min-h-24 px-3 py-2 text-sm leading-relaxed text-zinc-900 focus:outline-none dark:text-zinc-100",
  "[&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-base [&_h2]:font-semibold",
  "[&_h3]:mt-2.5 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold",
  "[&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_a]:text-orange-600 [&_a]:underline dark:[&_a]:text-orange-400",
  "[&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs dark:[&_code]:bg-zinc-800",
  "[&_pre]:my-2 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-zinc-100 [&_pre]:p-2.5 [&_pre]:text-xs dark:[&_pre]:bg-zinc-800",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-500 dark:[&_blockquote]:border-zinc-700",
  "[&_hr]:my-3 [&_hr]:border-zinc-200 dark:[&_hr]:border-zinc-800",
  "[&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0",
  "[&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:items-start [&_ul[data-type=taskList]_li]:gap-2",
  "[&_ul[data-type=taskList]_li>label]:mt-1 [&_ul[data-type=taskList]_li>div]:flex-1",
  "[&_sub]:align-sub [&_sub]:text-[0.75em] [&_sup]:align-super [&_sup]:text-[0.75em]",
  "[&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:text-zinc-400 [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
].join(" ");

const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);

function shortcutLabel(parts: string[]): string {
  return parts
    .map((part) => {
      if (part === "Mod") return IS_MAC ? "⌘" : "Ctrl";
      if (part === "Shift") return IS_MAC ? "⇧" : "Shift";
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
            : "text-zinc-500 hover:bg-zinc-200/80 dark:text-zinc-400 dark:hover:bg-zinc-800",
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
  shortcut,
  active,
  muted,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  shortcut: string;
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
      <span className="flex-1">{label}</span>
      <kbd className="rounded bg-zinc-100 px-1.5 py-0.5 font-sans text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        {shortcut}
      </kbd>
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
function AiMenu({ editor }: { editor: Editor }) {
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

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 bg-zinc-50 px-1.5 py-1 dark:border-zinc-800 dark:bg-zinc-950">
      <AiMenu editor={editor} />

      <ToolbarDivider />

      <FormatTextMenu editor={editor} />
      <ListsMenu editor={editor} />

      <ToolbarDivider />

      <ToolbarButton
        label="Heading 2"
        icon={Heading2}
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        label="Heading 3"
        icon={Heading3}
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />

      <ToolbarDivider />

      <ToolbarButton
        label="Quote"
        icon={Quote}
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        label="Code block"
        icon={Code}
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <ToolbarButton label="Divider" icon={Minus} onClick={() => editor.chain().focus().setHorizontalRule().run()} />
      <ToolbarButton
        label="Link"
        icon={Link2}
        active={editor.isActive("link")}
        onClick={() => {
          const previousUrl = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("Link URL", previousUrl ?? "");
          if (url === null) return;
          if (!url.trim()) {
            editor.chain().focus().unsetLink().run();
            return;
          }
          editor.chain().focus().setLink({ href: url.trim() }).run();
        }}
      />

      <ToolbarDivider />

      <ToolbarButton label="Undo" icon={Undo2} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} />
      <ToolbarButton label="Redo" icon={Redo2} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} />
    </div>
  );
}

/**
 * A small on-theme rich text editor (Tiptap) that reads and writes plain
 * Markdown — the value/onChange contract is a Markdown string, same as
 * every other text field in the app, so storage and safe rendering
 * elsewhere (MarkdownView) don't change. Never stores or emits raw HTML.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Subscript,
      Superscript,
      ExtraKeyboardShortcuts,
      Link.configure({ openOnClick: false, autolink: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Markdown.configure({ html: false, transformCopiedText: true, transformPastedText: true }),
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

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700", className)}>
      {editor && <Toolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="min-h-0 flex-1 overflow-y-auto [&_.ProseMirror]:min-h-[12rem] [&_.ProseMirror]:h-full"
      />
    </div>
  );
}
