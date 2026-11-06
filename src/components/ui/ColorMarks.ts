import { Extension, Mark } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import Heading from "@tiptap/extension-heading";
import { parseFontSize } from "@/lib/fontSize";
import { MAX_INDENT, isAlignment, isLineHeight, openTag, type Alignment, type BlockFormat } from "@/lib/blockFormat";

export { ALIGNMENTS, LINE_HEIGHTS, MAX_INDENT, type Alignment } from "@/lib/blockFormat";

// Text colour, highlight and alignment. Markdown can't store them, so they are saved as small HTML wrappers that
// every Markdown view in the app understands (see lib/remarkHtmlWrappers.ts):
//   <span data-c="#2563eb">blue text</span>    <span data-h="#fde047">highlighted</span>
//   <div align="center"> ... </div>
// The colour is stored as one hex value and drawn adapted to the theme (lighter in dark mode, darker in light mode),
// see the .tc and .hl rules in globals.css.

const HEX = /^#[0-9a-f]{6}$/i;

/** A strict #rrggbb colour, lower-cased, or null. Anything else is refused, so nothing odd can reach a style. */
export function normalizeHex(value: unknown): string | null {
  return typeof value === "string" && HEX.test(value.trim()) ? value.trim().toLowerCase() : null;
}

function colorMark(name: string, dataAttr: "data-c" | "data-h", cls: "tc" | "hl") {
  return Mark.create({
    name,
    addAttributes() {
      return {
        color: {
          default: null,
          parseHTML: (el) => normalizeHex(el.getAttribute(dataAttr)),
          rendered: false,
        },
      };
    },
    parseHTML() {
      return [{ tag: `span[${dataAttr}]`, getAttrs: (el) => (normalizeHex((el as HTMLElement).getAttribute(dataAttr)) ? {} : false) }];
    },
    renderHTML({ mark }) {
      const color = normalizeHex(mark.attrs.color) ?? "#888888";
      return ["span", { [dataAttr]: color, class: cls, style: `--c:${color}` }, 0];
    },
    addStorage() {
      return {
        markdown: {
          serialize: {
            open: (_state: unknown, mark: { attrs: { color: string } }) => `<span ${dataAttr}="${normalizeHex(mark.attrs.color) ?? "#888888"}">`,
            close: "</span>",
            mixable: true,
            expelEnclosingWhitespace: true,
          },
          parse: {},
        },
      };
    },
  });
}

/** Font size in pixels: <span data-s="18">. The old words (sm, lg, xl) are still read. */
export const TextSize = Mark.create({
  name: "textSize",
  addAttributes() {
    return { size: { default: null, parseHTML: (el) => parseFontSize(el.getAttribute("data-s")), rendered: false } };
  },
  parseHTML() {
    return [{ tag: "span[data-s]", getAttrs: (el) => (parseFontSize((el as HTMLElement).getAttribute("data-s")) ? {} : false) }];
  },
  renderHTML({ mark }) {
    const size = parseFontSize(mark.attrs.size) ?? 18;
    return ["span", { "data-s": String(size), class: "ts", style: `font-size:${size}px` }, 0];
  },
  addStorage() {
    return {
      markdown: {
        serialize: {
          open: (_state: unknown, mark: { attrs: { size: number } }) => `<span data-s="${parseFontSize(mark.attrs.size) ?? 18}">`,
          close: "</span>",
          mixable: true,
          expelEnclosingWhitespace: true,
        },
        parse: {},
      },
    };
  },
});

export const TextColor = colorMark("textColor", "data-c", "tc");
export const Highlight = colorMark("highlight", "data-h", "hl");

type SerializerState = {
  write: (s: string) => void;
  renderInline: (node: unknown) => void;
  closeBlock: (node: unknown) => void;
  repeat: (s: string, n: number) => string;
};
type AlignedNode = { attrs: { textAlign?: string; lineHeight?: string | null; indent?: number | null; dir?: string | null; level?: number } };

/** The wrapper tag a block needs (null for the default look). */
function blockTag(attrs: AlignedNode["attrs"]): string | null {
  const format: BlockFormat = {};
  if (isAlignment(attrs.textAlign) && attrs.textAlign !== "left") format.align = attrs.textAlign;
  if (attrs.dir === "rtl") format.dir = "rtl";
  if (isLineHeight(attrs.lineHeight)) format.lineHeight = attrs.lineHeight;
  if (attrs.indent && attrs.indent > 0) format.indent = Math.min(MAX_INDENT, Math.round(attrs.indent));
  return openTag(format);
}

/** Writes a block, wrapped in a <div …> when it has non-default formatting (only at the top level of the note). */
function writeAligned(state: SerializerState, node: AlignedNode, parent: { type: { name: string } } | undefined, body: () => void) {
  const tag = blockTag(node.attrs);
  if (tag && parent?.type.name === "doc") {
    state.write(`${tag}\n\n`);
    body();
    state.write("\n\n</div>");
  } else {
    body();
  }
  state.closeBlock(node);
}

// The wrapper div's attributes (or the block's own style) give the format back when a note is loaded.
const wrapperAttr = (el: HTMLElement, name: string) => (el.parentElement?.tagName === "DIV" ? el.parentElement.getAttribute(name) : null);

const alignAttribute = {
  textAlign: {
    default: "left",
    parseHTML: (el: HTMLElement) => {
      const own = el.style.textAlign;
      const wrapper = wrapperAttr(el, "align");
      return isAlignment(own) ? own : isAlignment(wrapper) ? wrapper : "left";
    },
    renderHTML: (attrs: { textAlign?: string }) => (attrs.textAlign && attrs.textAlign !== "left" ? { style: `text-align:${attrs.textAlign}` } : {}),
  },
  lineHeight: {
    default: null,
    parseHTML: (el: HTMLElement) => {
      const v = wrapperAttr(el, "data-ls") ?? el.style.lineHeight;
      return isLineHeight(v) ? v : null;
    },
    renderHTML: (attrs: { lineHeight?: string | null }) => (isLineHeight(attrs.lineHeight) ? { style: `line-height:${attrs.lineHeight}` } : {}),
  },
  indent: {
    default: 0,
    parseHTML: (el: HTMLElement) => {
      const n = Number(wrapperAttr(el, "data-ind"));
      return Number.isInteger(n) && n >= 1 && n <= MAX_INDENT ? n : 0;
    },
    renderHTML: (attrs: { indent?: number }) => (attrs.indent && attrs.indent > 0 ? { style: `margin-inline-start:${attrs.indent * 2}rem` } : {}),
  },
  dir: {
    default: null,
    parseHTML: (el: HTMLElement) => (wrapperAttr(el, "dir") === "rtl" ? "rtl" : null),
    renderHTML: (attrs: { dir?: string | null }) => (attrs.dir === "rtl" ? { dir: "rtl" } : {}),
  },
};

/** Paragraphs and headings that remember their alignment. */
export const AlignedParagraph = Paragraph.extend({
  addAttributes() {
    return { ...this.parent?.(), ...alignAttribute };
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: SerializerState, node: AlignedNode, parent: { type: { name: string } } | undefined) {
          writeAligned(state, node, parent, () => state.renderInline(node));
        },
        parse: {},
      },
    };
  },
});

export const AlignedHeading = Heading.extend({
  addAttributes() {
    return { ...this.parent?.(), ...alignAttribute };
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: SerializerState, node: AlignedNode, parent: { type: { name: string } } | undefined) {
          writeAligned(state, node, parent, () => {
            state.write(`${state.repeat("#", node.attrs.level ?? 1)} `);
            state.renderInline(node);
          });
        },
        parse: {},
      },
    };
  },
});

/** Keyboard shortcuts for alignment: Ctrl/Cmd + Shift + L (left), E (center), R (right), J (justify). */
export const AlignShortcuts = Extension.create({
  name: "alignShortcuts",
  addKeyboardShortcuts() {
    const set = (align: Alignment) => () =>
      this.editor.chain().focus().updateAttributes("paragraph", { textAlign: align }).updateAttributes("heading", { textAlign: align }).run();
    return { "Mod-Shift-l": set("left"), "Mod-Shift-e": set("center"), "Mod-Shift-r": set("right"), "Mod-Shift-j": set("justify") };
  },
});

/** Sets paragraph formatting (alignment, spacing, indent, direction) on the paragraphs and headings in the selection. */
export function setBlockFormat(editor: import("@tiptap/core").Editor, attrs: Partial<{ textAlign: Alignment; lineHeight: string | null; indent: number; dir: "rtl" | null }>) {
  editor.chain().focus().updateAttributes("paragraph", attrs).updateAttributes("heading", attrs).run();
}

/** The paragraph formatting at the cursor. */
export function blockFormatAt(editor: import("@tiptap/core").Editor) {
  const a = (editor.isActive("heading") ? editor.getAttributes("heading") : editor.getAttributes("paragraph")) as AlignedNode["attrs"];
  return {
    align: isAlignment(a.textAlign) ? a.textAlign : ("left" as Alignment),
    lineHeight: isLineHeight(a.lineHeight) ? a.lineHeight : null,
    indent: typeof a.indent === "number" ? a.indent : 0,
    dir: a.dir === "rtl" ? ("rtl" as const) : null,
  };
}
