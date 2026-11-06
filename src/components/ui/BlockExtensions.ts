import { Extension, mergeAttributes, Node } from "@tiptap/core";
import { Plugin, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { alertMarkerLine, parseAlertMarker, TOC_MARKER, type AlertMarker, type CalloutType } from "@/lib/alerts";
import { embedSource, EMBED_ALT } from "@/lib/embed";
import { renderMermaid } from "@/lib/mermaidClient";

// Block types that Markdown has no syntax for. Each one is saved as ordinary Markdown (a marked block quote, an image
// with a special description, a fenced code block, a [TOC] line) so it survives storage and shows up in every view.

type SerializerState = {
  wrapBlock: (delim: string, firstDelim: string | null, node: unknown, f: () => void) => void;
  write: (s: string) => void;
  ensureNewLine: () => void;
  renderContent: (node: unknown) => void;
  closeBlock: (node: unknown) => void;
};

/** If the block quote starts with the wanted marker, removes it from the DOM and returns what it said. */
function consumeMarker(el: HTMLElement, want: AlertMarker["kind"]): AlertMarker | null {
  const p = el.firstElementChild;
  if (!p || p.tagName !== "P") return null;
  const info = parseAlertMarker(p.textContent ?? "");
  if (!info || info.kind !== want) return null;
  const first = p.firstChild;
  if (first && first.nodeType === 3) {
    first.nodeValue = (first.nodeValue ?? "").replace(/^\s*\[!(INFO|NOTE|TIP|WARNING|DANGER|TOGGLE)\][ \t]*\r?\n?/i, "");
  }
  // The marker sat on its own line, so a line break may be left in front of the real text.
  while (p.firstChild) {
    const c = p.firstChild;
    if (c.nodeType === 3 && !(c.nodeValue ?? "").length) p.removeChild(c);
    else if (c.nodeName === "BR") {
      p.removeChild(c);
      break;
    } else break;
  }
  if (!(p.textContent ?? "").trim() && !p.querySelector("img")) p.remove();
  return info;
}

function serializeMarked(state: SerializerState, node: { attrs: Record<string, unknown> }, marker: string) {
  state.wrapBlock("> ", null, node, () => {
    state.write(marker);
    state.ensureNewLine();
    state.renderContent(node);
  });
}

/** An info / tip / warning / danger box. Saved as "> [!WARNING]" followed by the text. */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return { type: { default: "info" } };
  },

  parseHTML() {
    return [
      {
        tag: "blockquote",
        priority: 1000,
        getAttrs: (el) => {
          const info = consumeMarker(el as HTMLElement, "callout");
          return info && info.kind === "callout" ? { type: info.type } : false;
        },
      },
    ];
  },

  renderHTML({ node }) {
    const type = node.attrs.type as CalloutType;
    return ["div", mergeAttributes({ class: `callout callout-${type}`, "data-callout": type }), 0];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: SerializerState, node: { attrs: Record<string, unknown> }) {
          serializeMarked(state, node, alertMarkerLine(node.attrs.type as CalloutType));
        },
        parse: {},
      },
    };
  },
});

/** A collapsible section: the first paragraph is the title, the rest is hidden while it is closed. */
export const Toggle = Node.create({
  name: "toggle",
  group: "block",
  content: "paragraph block*",
  defining: true,

  addAttributes() {
    return { open: { default: true, rendered: false } };
  },

  parseHTML() {
    return [
      {
        tag: "blockquote",
        priority: 1000,
        getAttrs: (el) => (consumeMarker(el as HTMLElement, "toggle") ? {} : false),
      },
    ];
  },

  renderHTML({ node }) {
    return ["div", mergeAttributes({ class: "toggle", "data-toggle": "", "data-open": node.attrs.open ? "true" : "false" }), 0];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: SerializerState, node: { attrs: Record<string, unknown> }) {
          serializeMarked(state, node, alertMarkerLine("toggle"));
        },
        parse: {},
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            // A click on the arrow in front of the title opens or closes the section.
            mousedown(view, event) {
              const target = event.target as HTMLElement | null;
              const title = target?.closest(".toggle > p:first-child") as HTMLElement | null;
              const toggle = title?.parentElement;
              if (!title || !toggle || event.clientX - title.getBoundingClientRect().left > 26) return false;
              const pos = view.posAtDOM(toggle, 0) - 1;
              const node = view.state.doc.nodeAt(pos);
              if (!node || node.type.name !== "toggle") return false;
              view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, open: !node.attrs.open }));
              event.preventDefault();
              return true;
            },
          },
        },
      }),
    ];
  },
});

/** A YouTube / Vimeo / Loom / Figma frame. Saved as ![embed](link); the frame address is rebuilt from the link. */
export const Embed = Node.create({
  name: "embed",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return { src: { default: "" } };
  },

  parseHTML() {
    return [
      {
        tag: "img[src]",
        priority: 1000,
        getAttrs: (el) => {
          const node = el as HTMLElement;
          const src = node.getAttribute("src") ?? "";
          return node.getAttribute("alt") === EMBED_ALT && embedSource(src) ? { src } : false;
        },
      },
      {
        tag: "div[data-embed]",
        getAttrs: (el) => {
          const src = (el as HTMLElement).getAttribute("data-embed") ?? "";
          return embedSource(src) ? { src } : false;
        },
      },
    ];
  },

  renderHTML({ node }) {
    const info = embedSource(String(node.attrs.src));
    return [
      "div",
      { class: "embed-block", "data-embed": node.attrs.src, contenteditable: "false", style: `aspect-ratio:${info?.ratio ?? "16 / 9"}` },
      [
        "iframe",
        {
          src: info?.src ?? "about:blank",
          loading: "lazy",
          allowfullscreen: "true",
          referrerpolicy: "no-referrer",
          sandbox: "allow-scripts allow-same-origin allow-presentation allow-popups",
          allow: "fullscreen; picture-in-picture",
        },
      ],
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: SerializerState, node: { attrs: { src: string } }) {
          state.write(`![${EMBED_ALT}](${node.attrs.src})`);
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
});

/** A line that says [TOC] shows a live table of contents built from the note's headings (levels 1 to 3). */
const TocPreview = Extension.create({
  name: "tocPreview",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const headings: { level: number; text: string; pos: number }[] = [];
            const markers: { pos: number; size: number }[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name === "heading" && node.attrs.level <= 3) headings.push({ level: node.attrs.level, text: node.textContent, pos });
              if (node.type.name === "paragraph" && node.textContent.trim().toUpperCase() === TOC_MARKER) markers.push({ pos, size: node.nodeSize });
              return true;
            });
            if (markers.length === 0) return DecorationSet.empty;
            const signature = headings.map((h) => `${h.pos}:${h.level}:${h.text}`).join("|");
            const decorations: Decoration[] = [];
            for (const m of markers) {
              decorations.push(Decoration.node(m.pos, m.pos + m.size, { class: "toc-source" }));
              decorations.push(
                Decoration.widget(
                  m.pos + m.size,
                  (view) => {
                    const nav = document.createElement("nav");
                    nav.className = "toc-preview";
                    nav.contentEditable = "false";
                    if (headings.length === 0) {
                      nav.innerHTML = '<p class="toc-empty">Add headings and they will be listed here.</p>';
                      return nav;
                    }
                    for (const h of headings) {
                      const a = document.createElement("button");
                      a.type = "button";
                      a.className = `toc-item toc-l${h.level}`;
                      a.textContent = h.text || "Untitled";
                      a.addEventListener("mousedown", (e) => {
                        e.preventDefault();
                        const el = view.nodeDOM(h.pos);
                        if (el instanceof HTMLElement) el.scrollIntoView({ behavior: "smooth", block: "start" });
                      });
                      nav.appendChild(a);
                    }
                    return nav;
                  },
                  { side: -1, key: `toc-${m.pos}-${signature}` },
                ),
              );
            }
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

// Codes whose diagram failed to draw. Their source stays visible so the mistake can be fixed.
const failedDiagrams = new Set<string>();

/**
 * A ```mermaid block shows as the drawn diagram, with Edit code / Remove buttons. The code is hidden while the diagram
 * is fine and the cursor is elsewhere; it opens for editing (with a live preview) and whenever the code can't be drawn.
 */
const MermaidPreview = Extension.create({
  name: "mermaidPreview",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const { from, to } = state.selection;
            state.doc.descendants((node, pos) => {
              if (node.type.name !== "codeBlock" || node.attrs.language !== "mermaid") return true;
              const code = node.textContent;
              const size = node.nodeSize;
              if (!code.trim()) return false;
              const editing = from >= pos && to <= pos + size;
              const failed = failedDiagrams.has(code);
              decorations.push(Decoration.node(pos, pos + size, { class: editing || failed ? "mermaid-source mermaid-source-open" : "mermaid-source" }));
              decorations.push(
                Decoration.widget(
                  pos,
                  (view, getPos) => {
                    const wrap = document.createElement("div");
                    wrap.className = "mermaid-block";
                    wrap.contentEditable = "false";

                    const preview = document.createElement("div");
                    preview.className = "mermaid-preview";
                    preview.textContent = "Drawing diagram\u2026";
                    wrap.appendChild(preview);
                    renderMermaid(code)
                      .then((svg) => {
                        // mermaid's strict mode has already sanitised this SVG.
                        preview.innerHTML = svg;
                      })
                      .catch(() => {
                        preview.innerHTML = '<p class="chart-preview-error">This diagram has a syntax error, so it can\'t be drawn yet. Fix the code below.</p>';
                        if (!failedDiagrams.has(code)) {
                          failedDiagrams.add(code);
                          // Redraw the decorations so the code opens.
                          view.dispatch(view.state.tr.setMeta("mermaid-refresh", true));
                        }
                      });

                    const actions = document.createElement("div");
                    actions.className = "chart-actions";
                    const button = (label: string, run: () => void) => {
                      const b = document.createElement("button");
                      b.type = "button";
                      b.textContent = label;
                      b.addEventListener("mousedown", (e) => {
                        e.preventDefault();
                        run();
                      });
                      return b;
                    };
                    const nodePos = () => getPos() ?? pos;
                    actions.appendChild(
                      button(editing ? "Done editing" : "Edit code", () => {
                        const at = nodePos();
                        const target = editing ? at + size + 1 : at + 1;
                        const clamped = Math.min(target, view.state.doc.content.size);
                        view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(clamped))).scrollIntoView());
                        view.focus();
                      }),
                    );
                    actions.appendChild(
                      button("Remove diagram", () => {
                        const at = nodePos();
                        view.dispatch(view.state.tr.delete(at, at + size));
                        view.focus();
                      }),
                    );
                    wrap.appendChild(actions);
                    return wrap;
                  },
                  { side: -1, key: `mermaid-${code}-${editing ? "e" : "v"}-${failed ? "f" : "ok"}` },
                ),
              );
              return false;
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

export const BlockExtensions = [Callout, Toggle, Embed, TocPreview, MermaidPreview];
