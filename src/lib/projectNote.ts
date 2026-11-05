import "server-only";
import { prisma } from "@/lib/prisma";

export const MAX_NOTE_LENGTH = 100_000;

export type ProjectNoteView = { content: string; updatedByName: string | null; updatedAt: string | null };

export async function getProjectNote(projectId: string): Promise<ProjectNoteView> {
  const row = await prisma.projectNote.findUnique({ where: { projectId } });
  return {
    content: row?.content ?? "",
    updatedByName: row?.updatedByName ?? null,
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
}

export async function saveProjectNote(projectId: string, content: string, actorName: string): Promise<ProjectNoteView> {
  const trimmed = content.slice(0, MAX_NOTE_LENGTH);
  const row = await prisma.projectNote.upsert({
    where: { projectId },
    create: { projectId, content: trimmed, updatedByName: actorName },
    update: { content: trimmed, updatedByName: actorName },
  });
  return { content: row.content, updatedByName: row.updatedByName, updatedAt: row.updatedAt.toISOString() };
}
