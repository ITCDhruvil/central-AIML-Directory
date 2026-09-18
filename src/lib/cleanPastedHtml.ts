/**
 * Strips the clutter that rich sources (Word, Confluence, Google Docs, Outlook)
 * inject into copied HTML, before Tiptap parses it into editor content — so a
 * paste turns into clean structural markup instead of dozens of spans/styles.
 */
export function cleanPastedHtml(html: string): string {
  return html
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<meta[^>]*>/gi, "")
    .replace(/<xml[\s\S]*?<\/xml>/gi, "")
    .replace(/<o:p[^>]*>[\s\S]*?<\/o:p>/gi, "")
    .replace(/<\/?o:p>/gi, "")
    .replace(/\sclass="[^"]*"/gi, "")
    .replace(/\sstyle="[^"]*"/gi, "")
    .replace(/\slang="[^"]*"/gi, "")
    .replace(/<span[^>]*>\s*<\/span>/gi, "")
    .replace(/<span([^>]*)>/gi, "")
    .replace(/<\/span>/gi, "")
    .replace(/<(b|strong|i|em|u)>\s*<\/\1>/gi, "");
}
