import { formatFileSize, MAX_UPLOAD_BYTES } from "@/lib/uploadFile";
import { isUploadableFile, prepareUpload } from "@/lib/uploadDocument";

export type UploadResult = { ok: true } | { ok: false; error: string };

async function errorFrom(res: Response, fileName: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return `${fileName}: ${body.error ?? "could not be uploaded"}`;
}

/**
 * Adds one file to a project's documentation. Text and Markdown become editable documents; anything else (PDF, images,
 * Office files, ...) is stored as a file to download. A text file too big to edit is kept as a file instead of refused.
 */
export async function uploadDocumentFile(projectId: string, file: File): Promise<UploadResult> {
  try {
    if (isUploadableFile(file.name)) {
      const payload = prepareUpload(file.name, await file.text());
      if (!("error" in payload)) {
        const res = await fetch(`/api/projects/${projectId}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        return res.ok ? { ok: true } : { ok: false, error: await errorFrom(res, file.name) };
      }
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return { ok: false, error: `${file.name}: too large (limit is ${formatFileSize(MAX_UPLOAD_BYTES)}).` };
    }
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/projects/${projectId}/documents/upload`, { method: "POST", body: form });
    return res.ok ? { ok: true } : { ok: false, error: await errorFrom(res, file.name) };
  } catch {
    return { ok: false, error: `${file.name}: network error` };
  }
}
