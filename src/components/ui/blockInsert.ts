import type { Editor } from "@tiptap/core";
import type { CalloutType } from "@/lib/alerts";
import { TOC_MARKER } from "@/lib/alerts";

export type BlockKind = `callout:${CalloutType}` | "toggle" | "toc" | "mermaid";

const MERMAID_SAMPLE = "graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Do it]\n  B -->|No| D[Skip]";

/** Inserts (or wraps the current block in) one of the extra block types. */
export function insertBlock(editor: Editor, kind: BlockKind) {
  // An editor created before these block types were loaded (for example across a hot reload) doesn't know them; do nothing rather than throw.
  const needed = kind.startsWith("callout:") ? "callout" : kind === "toggle" ? "toggle" : null;
  if (needed && !editor.schema.nodes[needed]) {
    editor.view.dom.dispatchEvent(new CustomEvent("editor-error", { detail: "This editor was opened before callouts and toggles were added. Refresh the page and try again." }));
    return;
  }
  const chain = editor.chain().focus();
  if (kind.startsWith("callout:")) {
    const type = kind.slice(8) as CalloutType;
    // Wrapping keeps whatever the person already typed on the line.
    if (!editor.isActive("callout") && chain.wrapIn("callout", { type }).run()) return;
    if (editor.isActive("callout")) editor.chain().focus().updateAttributes("callout", { type }).run();
    return;
  }
  if (kind === "toggle") {
    chain
      .insertContent({
        type: "toggle",
        attrs: { open: true },
        content: [{ type: "paragraph", content: [{ type: "text", text: "Toggle title" }] }, { type: "paragraph" }],
      })
      .run();
  } else if (kind === "toc") {
    chain.insertContent([{ type: "paragraph", content: [{ type: "text", text: TOC_MARKER }] }, { type: "paragraph" }]).run();
  } else if (kind === "mermaid") {
    chain.insertContent({ type: "codeBlock", attrs: { language: "mermaid" }, content: [{ type: "text", text: MERMAID_SAMPLE }] }).run();
  }
}

/** Adds a YouTube / Vimeo / Loom / Figma frame for an already-validated link. */
export function insertEmbed(editor: Editor, src: string) {
  if (!editor.schema.nodes.embed) return;
  editor.chain().focus().insertContent([{ type: "embed", attrs: { src } }, { type: "paragraph" }]).run();
}
