import { mergeAttributes, Node } from "@tiptap/core";
import { mediaMarkdownAlt, parseMediaAlt, safeMediaSrc } from "@/lib/media";

/**
 * A video or audio clip in a note. Markdown has no such thing, so it is saved as an image whose description starts
 * with the kind (![video: demo.mp4](/api/media/abc)) and drawn here, and wherever Markdown is shown, as a player.
 */
export const Media = Node.create({
  name: "media",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      kind: { default: "video" },
      src: { default: "" },
      name: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        // Beats the plain image rule when the description says it is a video or audio clip.
        tag: "img[src]",
        priority: 1000,
        getAttrs: (el) => {
          const node = el as HTMLElement;
          const info = parseMediaAlt(node.getAttribute("alt"));
          const src = safeMediaSrc(node.getAttribute("src") ?? "");
          return info && src ? { kind: info.kind, src, name: info.name } : false;
        },
      },
      {
        tag: "div[data-media]",
        getAttrs: (el) => {
          const node = el as HTMLElement;
          const kind = node.getAttribute("data-media");
          const src = safeMediaSrc(node.getAttribute("data-src") ?? "");
          return (kind === "video" || kind === "audio") && src ? { kind, src, name: node.getAttribute("data-name") ?? "" } : false;
        },
      },
    ];
  },

  renderHTML({ node }) {
    const { kind, src, name } = node.attrs as { kind: "video" | "audio"; src: string; name: string };
    return [
      "div",
      mergeAttributes({ class: `media-block media-${kind}`, "data-media": kind, "data-src": src, "data-name": name, contenteditable: "false" }),
      [kind, { src, controls: "true", preload: "metadata" }],
      ["div", { class: "media-caption" }, name || (kind === "video" ? "Video" : "Audio")],
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (s: string) => void; closeBlock: (n: unknown) => void }, node: { attrs: { kind: "video" | "audio"; name: string; src: string } }) {
          state.write(`![${mediaMarkdownAlt(node.attrs.kind, node.attrs.name)}](${node.attrs.src})`);
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
});
