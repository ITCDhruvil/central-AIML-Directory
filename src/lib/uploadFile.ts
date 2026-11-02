/** Largest uploaded file. Kept under common hosting request-body limits (e.g. 4.5 MB on serverless platforms). */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The part of a name a person would call its type, lower-cased and without the dot ("report.PDF" -> "pdf"). */
export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

/**
 * Types the browser may show in place. Everything else is only ever sent as a download, because an uploaded .html or
 * .svg served inline from this origin could run script with the signed-in user's session.
 */
const INLINE_SAFE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export function isInlineSafe(contentType: string): boolean {
  return INLINE_SAFE_TYPES.has(contentType.toLowerCase());
}

/** An uploaded file's title without a trailing ".pdf"-style extension (older uploads were titled with the full file name). */
export function displayTitle(title: string, file: { name: string } | null | undefined): string {
  const ext = file ? fileExtension(file.name) : "";
  if (!ext) return title;
  const suffix = `.${ext}`;
  return title.toLowerCase().endsWith(suffix) ? title.slice(0, -suffix.length) || title : title;
}

/** Strips path parts and control characters so a name is safe to show and to put in a header. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, "").trim();
  return (cleaned || "file").slice(0, 200);
}
