import "server-only";
import { prisma } from "@/lib/prisma";
import { snapshotBeforeSave } from "@/lib/noteExtras";

export const MAX_DAY_NOTE_LENGTH = 100_000;

export type DayNoteScope = { type: "USER" | "PROJECT"; id: string };
export type DayNoteView = { day: string; content: string; authorName: string | null; updatedAt: string | null };
export type DayNoteEntry = { day: string; content: string };

function key(scope: DayNoteScope, day: string) {
  return { scopeType_scopeId_day: { scopeType: scope.type, scopeId: scope.id, day } };
}

/** Which days in a month already have a (non-empty) entry, so the calendar can mark them. */
export async function listMonthDays(scope: DayNoteScope, month: string): Promise<string[]> {
  const rows = await prisma.dayNote.findMany({
    where: { scopeType: scope.type, scopeId: scope.id, day: { startsWith: `${month}-` }, content: { not: "" } },
    select: { day: true },
  });
  return rows.map((r) => r.day);
}

export async function getDayNote(scope: DayNoteScope, day: string): Promise<DayNoteView> {
  const row = await prisma.dayNote.findUnique({ where: key(scope, day) });
  return { day, content: row?.content ?? "", authorName: row?.authorName ?? null, updatedAt: row?.updatedAt.toISOString() ?? null };
}

export async function saveDayNote(scope: DayNoteScope, day: string, content: string, actorName: string): Promise<DayNoteView> {
  const trimmed = content.slice(0, MAX_DAY_NOTE_LENGTH);
  // Keep the text being replaced as a restore point when it is time for one (see noteExtras.snapshotBeforeSave).
  const existing = await prisma.dayNote.findUnique({ where: key(scope, day), select: { content: true } });
  await snapshotBeforeSave(scope, day, existing?.content ?? null, trimmed, actorName);
  const row = await prisma.dayNote.upsert({
    where: key(scope, day),
    create: { scopeType: scope.type, scopeId: scope.id, day, content: trimmed, authorName: actorName },
    update: { content: trimmed, authorName: actorName },
  });
  return { day, content: row.content, authorName: row.authorName, updatedAt: row.updatedAt.toISOString() };
}

/** Non-empty entries between two days (inclusive), oldest first — for the weekly summary. */
export async function listDayNotesInRange(scope: DayNoteScope, fromDay: string, toDay: string): Promise<DayNoteEntry[]> {
  const rows = await prisma.dayNote.findMany({
    where: { scopeType: scope.type, scopeId: scope.id, day: { gte: fromDay, lte: toDay }, content: { not: "" } },
    orderBy: { day: "asc" },
    select: { day: true, content: true },
  });
  return rows.map((r) => ({ day: r.day, content: r.content }));
}

export type DigestNote = { label: string; day: string; content: string };

/**
 * Recent day-notes for the dashboard digest: the viewer's own personal notes plus every project's log entries
 * (the digest is only shown to full-access users). Project entries are labelled with the project's name.
 */
export async function recentDayNotesForDigest(userId: string, fromDay: string, limit = 200): Promise<DigestNote[]> {
  const rows = await prisma.dayNote.findMany({
    where: {
      day: { gte: fromDay },
      content: { not: "" },
      OR: [
        { scopeType: "USER", scopeId: userId },
        { scopeType: "PROJECT" },
      ],
    },
    orderBy: { day: "asc" },
    take: limit,
    select: { scopeType: true, scopeId: true, day: true, content: true },
  });
  const projectIds = [...new Set(rows.filter((r) => r.scopeType === "PROJECT").map((r) => r.scopeId))];
  const projects = projectIds.length ? await prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true } }) : [];
  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  return rows.map((r) => ({
    label: r.scopeType === "USER" ? "My notes" : (nameById.get(r.scopeId) ?? "A project"),
    day: r.day,
    content: r.content,
  }));
}
