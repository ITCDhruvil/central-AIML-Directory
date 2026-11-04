// What kind of file something is, for icons, colours and which in-app preview (if any) can show it. Pure: shared by the
// documentation list, the document page and the preview endpoint.

export type FileKind = "pdf" | "spreadsheet" | "document" | "markdown" | "text" | "presentation" | "image" | "archive" | "code" | "other";

const BY_EXTENSION: Record<string, FileKind> = {
  pdf: "pdf",
  xlsx: "spreadsheet",
  xlsm: "spreadsheet",
  xls: "spreadsheet",
  ods: "spreadsheet",
  csv: "spreadsheet",
  tsv: "spreadsheet",
  doc: "document",
  docx: "document",
  odt: "document",
  rtf: "document",
  md: "markdown",
  markdown: "markdown",
  txt: "text",
  log: "text",
  ppt: "presentation",
  pptx: "presentation",
  odp: "presentation",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  gz: "archive",
  tar: "archive",
  json: "code",
  yaml: "code",
  yml: "code",
  xml: "code",
  html: "code",
  css: "code",
  js: "code",
  ts: "code",
  tsx: "code",
  jsx: "code",
  py: "code",
  sql: "code",
  sh: "code",
  ini: "code",
  toml: "code",
};

export function fileKindOf(extension: string, contentType = ""): FileKind {
  const byExt = BY_EXTENSION[extension.toLowerCase()];
  if (byExt) return byExt;
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("text/")) return "text";
  return "other";
}

/** Tailwind classes for a file type's icon tile, so each type is recognisable at a glance. */
export const KIND_TONE: Record<FileKind, string> = {
  pdf: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  spreadsheet: "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400",
  document: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  markdown: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  text: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  presentation: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
  image: "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400",
  archive: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  code: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400",
  other: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export type PreviewKind = "sheets" | "markdown" | "text" | "docx";

/** Which in-app preview can show an uploaded file with this extension, or null when only download is possible. */
export function previewKindFor(extension: string): PreviewKind | null {
  switch (extension.toLowerCase()) {
    case "xlsx":
    case "xlsm":
    case "csv":
    case "tsv":
      return "sheets";
    case "md":
    case "markdown":
      return "markdown";
    case "txt":
    case "log":
    case "json":
    case "yaml":
    case "yml":
    case "xml":
    case "ini":
    case "toml":
    case "sql":
    case "sh":
    case "py":
    case "js":
    case "ts":
    case "tsx":
    case "jsx":
    case "css":
      return "text";
    case "docx":
      return "docx";
    default:
      return null;
  }
}
