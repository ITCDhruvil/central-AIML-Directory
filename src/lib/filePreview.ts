import "server-only";
import mammoth from "mammoth";
import readExcelFile from "read-excel-file/node";
import { detectDelimiter, parseDelimited } from "@/lib/delimited";
import { previewKindFor } from "@/lib/fileKind";

export type PreviewSheet = {
  name: string;
  rows: string[][];
  totalRows: number;
  totalCols: number;
  truncated: boolean;
};

export type FilePreview =
  | { kind: "sheets"; sheets: PreviewSheet[] }
  | { kind: "markdown" | "text"; text: string; truncated: boolean }
  | { kind: "docx"; html: string };

// Caps keep a huge upload from producing a huge response (uploads are limited to 4 MB, but a sheet can expand a lot).
const MAX_SHEETS = 30;
const MAX_ROWS = 1000;
const MAX_COLS = 60;
const MAX_CELL = 500;
const MAX_TEXT = 500_000;

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  const text = String(value);
  return text.length > MAX_CELL ? `${text.slice(0, MAX_CELL)}…` : text;
}

function toSheet(name: string, data: unknown[][]): PreviewSheet {
  const totalRows = data.length;
  const totalCols = data.reduce((max, row) => Math.max(max, row.length), 0);
  const rows = data.slice(0, MAX_ROWS).map((row) => Array.from({ length: Math.min(totalCols, MAX_COLS) }, (_, i) => cellText(row[i])));
  return { name, rows, totalRows, totalCols, truncated: totalRows > MAX_ROWS || totalCols > MAX_COLS };
}

function decode(buffer: Buffer): string {
  return buffer.toString("utf8");
}

/** Builds the in-app preview of an uploaded file, or null when this type has none. Throws if the file can't be read. */
export async function buildPreview(buffer: Buffer, extension: string): Promise<FilePreview | null> {
  const kind = previewKindFor(extension);
  if (!kind) return null;

  if (kind === "sheets") {
    const ext = extension.toLowerCase();
    if (ext === "csv" || ext === "tsv") {
      const text = decode(buffer);
      return { kind: "sheets", sheets: [toSheet(ext === "tsv" ? "TSV" : "CSV", parseDelimited(text, detectDelimiter(text, ext)))] };
    }
    const all = await readExcelFile(buffer);
    return { kind: "sheets", sheets: all.slice(0, MAX_SHEETS).map((s) => toSheet(s.sheet, s.data as unknown[][])) };
  }

  if (kind === "docx") {
    // The HTML is only ever shown inside a sandboxed iframe (no scripts), so it needs no further cleaning here.
    const { value } = await mammoth.convertToHtml({ buffer });
    return { kind: "docx", html: value };
  }

  const text = decode(buffer);
  return { kind, text: text.slice(0, MAX_TEXT), truncated: text.length > MAX_TEXT };
}
