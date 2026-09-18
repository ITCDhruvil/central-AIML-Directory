import { prisma } from "@/lib/prisma";

/** Namespace prefix so manual documents can never collide with a real GitHub file path. */
export const MANUAL_PATH_PREFIX = "[manual]";

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
