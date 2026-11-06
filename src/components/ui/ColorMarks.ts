import { Mark } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import Heading from "@tiptap/extension-heading";

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

export const TextColor = colorMark("textColor", "data-c", "tc");
export const Highlight = colorMark("highlight", "data-h", "hl");

export const ALIGNMENTS = ["left", "center", "right", "justify"] as const;
export type Alignment = (typeof ALIGNMENTS)[number];
const isAlignment = (v: unknown): v is Alignment => typeof v === "string" && (ALIGNMENTS as readonly string[]).includes(v);

type SerializerState = {
  write: (s: string) => void;
  renderInline: (node: unknown) => void;
  closeBlock: (node: unknown) => void;
  repeat: (s: string, n: number) => string;
};
type AlignedNode = { attrs: { textAlign?: string; level?: number } };

/** Writes a block, wrapped in <div align="…"> when it is aligned (only at the top level of the note). */
function writeAligned(state: SerializerState, node: AlignedNode, parent: { type: { name: string } } | undefined, body: () => void) {
  const align = node.attrs.textAlign;
  if (isAlignment(align) && align !== "left" && parent?.type.name === "doc") {
    state.write(`<div align="${align}">\n\n`);
    body();
    state.write("\n\n</div>");
  } else {
    body();
  }
  state.closeBlock(node);
}

const alignAttribute = {
  textAlign: {
    default: "left",
    parseHTML: (el: HTMLElement) => {
      const own = el.style.textAlign;
      const wrapper = el.parentElement?.tagName === "DIV" ? el.parentElement.getAttribute("align") : null;
      const found = isAlignment(own) ? own : isAlignment(wrapper) ? wrapper : "left";
      return found;
    },
    renderHTML: (attrs: { textAlign?: string }) => (attrs.textAlign && attrs.textAlign !== "left" ? { style: `text-align:${attrs.textAlign}` } : {}),
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
