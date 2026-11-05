import "server-only";
import { prisma } from "@/lib/prisma";
import { buildPreview } from "@/lib/filePreview";
import { fileExtension } from "@/lib/uploadFile";

/** Plain text of a PDF (every page's text, in order). Uses pdfjs' Node-safe legacy build. */
async function extractPdfText(bytes: Buffer): Promise<string> {
  // Dynamic import so pdfjs (a large dependency) only loads when a PDF is actually indexed.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: true }).promise;
  try {
    let text = "";
    for (let p = 1; p <= doc.numPages; p += 1) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + "\n";
    }
    return text;
  } finally {
    await doc.destroy();
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/div|\/h[1-6]|\/li)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Readable text of an uploaded file, by type. Returns "" for files with no extractable text (images, archives). */
export async function extractUploadedFileText(fileName: string, bytes: Buffer): Promise<string> {
  const ext = fileExtension(fileName);
  if (ext === "pdf") return extractPdfText(bytes);
  const preview = await buildPreview(bytes, ext);
  if (!preview) return "";
  if (preview.kind === "sheets") {
    return preview.sheets.map((s) => `# ${s.name}\n${s.rows.map((r) => r.join("\t")).join("\n")}`).join("\n\n");
  }
  if (preview.kind === "docx") return stripHtml(preview.html);
  return preview.text;
}

export type IndexableDoc = { id: string; source: string; content: string };

/** The text to index for a document: its Markdown content, or the extracted text of its uploaded file. */
export async function extractDocumentText(doc: IndexableDoc): Promise<string> {
  if (doc.source === "upload") {
    const file = await prisma.documentFile.findUnique({ where: { documentId: doc.id } });
    if (!file) return "";
    return extractUploadedFileText(file.fileName, Buffer.from(file.data));
  }
  return doc.content ?? "";
}
