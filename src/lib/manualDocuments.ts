import { prisma } from "@/lib/prisma";

/** Namespace prefix so manual documents can never collide with a real GitHub file path. */
export const MANUAL_PATH_PREFIX = "[manual]";

/** Namespace prefix for uploaded files, for the same collision-proofing as the manual one. */
export const UPLOAD_PATH_PREFIX = "[upload]";

export function isManualFilePath(filePath: string): boolean {
  return filePath.startsWith(`${MANUAL_PATH_PREFIX}/`);
}

export function slugifyDocumentTitle(title: string): string {
  return (
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "document"
  );
}

/** Finds a filePath under the manual namespace that's free for this project, deduping like uniqueSlug(). */
export async function uniqueManualFilePath(
  projectId: string,
  title: string,
  excludeDocumentId?: string,
): Promise<string> {
  const base = slugifyDocumentTitle(title);
  let candidate = `${MANUAL_PATH_PREFIX}/${base}.md`;
  let suffix = 2;

  while (true) {
    const existing = await prisma.documentation.findUnique({
      where: { projectId_filePath: { projectId, filePath: candidate } },
    });
    if (!existing || existing.id === excludeDocumentId) {
      return candidate;
    }
    candidate = `${MANUAL_PATH_PREFIX}/${base}-${suffix}.md`;
    suffix += 1;
  }
}

/** Like uniqueManualFilePath, but keeps the file's own name and extension: `[upload]/report.pdf`, `[upload]/report-2.pdf`. */
export async function uniqueUploadFilePath(projectId: string, fileName: string): Promise<string> {
  const dot = fileName.lastIndexOf(".");
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot).toLowerCase() : "";
  const base = slugifyDocumentTitle(stem);
  let candidate = `${UPLOAD_PATH_PREFIX}/${base}${ext}`;
  let suffix = 2;

  while (await prisma.documentation.findUnique({ where: { projectId_filePath: { projectId, filePath: candidate } } })) {
    candidate = `${UPLOAD_PATH_PREFIX}/${base}-${suffix}${ext}`;
    suffix += 1;
  }
  return candidate;
}
