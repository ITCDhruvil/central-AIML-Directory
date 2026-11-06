import { createNodeFromContent, type Editor } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";
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

/** The page break line (a real break when printed or exported to PDF). */
export function insertPageBreak(editor: Editor) {
  if (!editor.schema.nodes.pageBreak) return;
  editor.chain().focus().insertContent([{ type: "pageBreak" }, { type: "paragraph" }]).run();
}

/** Puts a numbered footnote marker at the cursor and starts its definition at the end of the note. */
export function insertFootnote(editor: Editor) {
  const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, "\n", " ");
  const used = [...text.matchAll(/\[\^(\d+)\]/g)].map((m) => Number(m[1]));
  const n = (used.length ? Math.max(...used) : 0) + 1;
  editor.chain().focus().insertContent({ type: "text", text: `[^${n}]` }).run();
  editor
    .chain()
    .insertContentAt(editor.state.doc.content.size, { type: "paragraph", content: [{ type: "text", text: `[^${n}]: ` }] })
    .focus("end")
    .run();
}

/** Inserts Markdown (headings, lists, tables…) at the cursor as real blocks. */
export function insertMarkdown(editor: Editor, markdown: string) {
  const parser = (editor.storage.markdown as unknown as { parser: { parse: (m: string) => string } }).parser;
  const content = createNodeFromContent(parser.parse(markdown.trim()), editor.schema);
  const { from, to } = editor.state.selection;
  editor.view.dispatch(editor.state.tr.replaceRange(from, to, new Slice(Fragment.from(content), 0, 0)).scrollIntoView());
  editor.commands.focus();
}

export const BUILT_IN_TEMPLATES: { id: string; name: string; content: string }[] = [
  { id: "meeting", name: "Meeting notes", content: "## Meeting notes\n\n**Date:** \n**Attendees:** \n\n### Agenda\n- \n\n### Discussion\n- \n\n### Decisions\n- \n\n### Action items\n- [ ] " },
  { id: "standup", name: "Standup", content: "## Standup\n\n**Yesterday**\n- \n\n**Today**\n- \n\n**Blockers**\n- " },
  { id: "decision", name: "Decision record", content: "## Decision\n\n**Context**\n\n**Options considered**\n- \n\n**Decision**\n\n**Why**\n\n**Owner / date:** " },
  { id: "prd", name: "PRD", content: "# PRD\n\n## Problem\n\n## Goals\n- \n\n## Non-goals\n- \n\n## Requirements\n- \n\n## Success metrics\n- \n\n## Open questions\n- " },
];
