import "server-only";
import { prisma } from "@/lib/prisma";

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
