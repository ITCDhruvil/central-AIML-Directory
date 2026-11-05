import "server-only";
import { prisma } from "@/lib/prisma";
import { buildPreview } from "@/lib/filePreview";
import { fileExtension } from "@/lib/uploadFile";

/** Plain text of a PDF (all pages). Uses unpdf, which bundles a serverless-safe pdfjs (no external worker file). */
async function extractPdfText(bytes: Buffer): Promise<string> {
  // Dynamic import so the PDF engine only loads when a PDF is actually indexed.
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
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
