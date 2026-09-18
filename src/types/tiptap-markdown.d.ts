import type { MarkdownStorage } from "tiptap-markdown";

// tiptap-markdown doesn't ship this augmentation itself — its `Markdown`
// extension adds `storage.markdown` at runtime but the package's own types
// don't declare it on Tiptap's Storage interface.
declare module "@tiptap/core" {
  interface Storage {
    markdown: MarkdownStorage;
  }
}
