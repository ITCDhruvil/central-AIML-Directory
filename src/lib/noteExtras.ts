import "server-only";
import { prisma } from "@/lib/prisma";
import type { DayNoteScope } from "@/lib/dayNotes";

// Version history, extra pages, pins and personal templates for notes. Same scope model as day notes: a note belongs to a
// person (USER) or a project (PROJECT), and the caller has already been checked for access to that scope.

export const MAX_PAGE_LENGTH = 100_000;
export const MAX_PAGES_PER_KEY = 20;
const VERSION_GAP_MS = 5 * 60 * 1000;
const MAX_VERSIONS = 40;

const where = (scope: DayNoteScope) => ({ scopeType: scope.type, scopeId: scope.id });

// ---------------------------------------------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------------------------------------------

/**
 * Called just before a note is overwritten, with what it said and what it is about to say. Keeps the previous text as
 * a restore point when it has been 5 minutes since the last one, or when the change is big (a large deletion or an AI
 * rewrite), so the state from before a bad edit is always there. The 40 newest are kept.
 */
export async function snapshotBeforeSave(scope: DayNoteScope, noteKey: string, previous: string | null, next: string, actorName: string) {
  if (!previous || !previous.trim() || previous === next) return;
  const latest = await prisma.noteVersion.findFirst({ where: { ...where(scope), noteKey }, orderBy: { createdAt: "desc" }, select: { content: true, createdAt: true } });
  if (latest?.content === previous) return;
  const bigChange = Math.abs(next.length - previous.length) > Math.max(80, previous.length * 0.4);
  const stale = !latest || Date.now() - latest.createdAt.getTime() > VERSION_GAP_MS;
  if (!stale && !bigChange) return;
  await prisma.noteVersion.create({ data: { ...where(scope), noteKey, content: previous, authorName: actorName } });
  const extra = await prisma.noteVersion.findMany({ where: { ...where(scope), noteKey }, orderBy: { createdAt: "desc" }, skip: MAX_VERSIONS, select: { id: true } });
  if (extra.length) await prisma.noteVersion.deleteMany({ where: { id: { in: extra.map((v) => v.id) } } });
}

export type VersionSummary = { id: string; createdAt: string; authorName: string | null; length: number; preview: string };

export async function listVersions(scope: DayNoteScope, noteKey: string): Promise<VersionSummary[]> {
  const rows = await prisma.noteVersion.findMany({ where: { ...where(scope), noteKey }, orderBy: { createdAt: "desc" }, take: MAX_VERSIONS, select: { id: true, createdAt: true, authorName: true, content: true } });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    authorName: r.authorName,
    length: r.content.length,
    preview: r.content.replace(/[#>*_`\[\]!-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 140),
  }));
}

export async function getVersion(scope: DayNoteScope, id: string): Promise<{ id: string; content: string; createdAt: string } | null> {
  const row = await prisma.noteVersion.findFirst({ where: { id, ...where(scope) }, select: { id: true, content: true, createdAt: true } });
  return row ? { id: row.id, content: row.content, createdAt: row.createdAt.toISOString() } : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Extra pages (for a day or a week)
// ---------------------------------------------------------------------------------------------------------------

export type PageSummary = { id: string; key: string; title: string; position: number; pinned: boolean; empty: boolean };
export type PageView = PageSummary & { content: string; updatedAt: string };

const toSummary = (r: { id: string; key: string; title: string; position: number; pinned: boolean; content: string }): PageSummary => ({
  id: r.id,
  key: r.key,
  title: r.title,
  position: r.position,
  pinned: r.pinned,
  empty: !r.content.trim(),
});

export async function listPages(scope: DayNoteScope, key: string): Promise<PageSummary[]> {
  const rows = await prisma.dayNotePage.findMany({ where: { ...where(scope), key }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, key: true, title: true, position: true, pinned: true, content: true } });
  return rows.map(toSummary);
}

export async function createPage(scope: DayNoteScope, key: string, title: string, actorName: string): Promise<PageView | { error: string }> {
  const count = await prisma.dayNotePage.count({ where: { ...where(scope), key } });
  if (count >= MAX_PAGES_PER_KEY) return { error: `A ${key.startsWith("week:") ? "week" : "day"} can have up to ${MAX_PAGES_PER_KEY} pages.` };
  const last = await prisma.dayNotePage.findFirst({ where: { ...where(scope), key }, orderBy: { position: "desc" }, select: { position: true } });
  const row = await prisma.dayNotePage.create({ data: { ...where(scope), key, title: title.slice(0, 60), position: (last?.position ?? 0) + 1, authorName: actorName } });
  return { ...toSummary(row), content: row.content, updatedAt: row.updatedAt.toISOString() };
}

export async function getPage(scope: DayNoteScope, id: string): Promise<PageView | null> {
  const row = await prisma.dayNotePage.findFirst({ where: { id, ...where(scope) } });
  return row ? { ...toSummary(row), content: row.content, updatedAt: row.updatedAt.toISOString() } : null;
}

export async function savePage(scope: DayNoteScope, id: string, change: { content?: string; title?: string; pinned?: boolean }, actorName: string): Promise<PageView | null> {
  const current = await prisma.dayNotePage.findFirst({ where: { id, ...where(scope) } });
  if (!current) return null;
  const content = change.content === undefined ? undefined : change.content.slice(0, MAX_PAGE_LENGTH);
  if (content !== undefined) await snapshotBeforeSave(scope, `page:${id}`, current.content, content, actorName);
  const row = await prisma.dayNotePage.update({
    where: { id },
    data: { ...(content !== undefined ? { content } : {}), ...(change.title !== undefined ? { title: change.title.slice(0, 60) } : {}), ...(change.pinned !== undefined ? { pinned: change.pinned } : {}), authorName: actorName },
  });
  return { ...toSummary(row), content: row.content, updatedAt: row.updatedAt.toISOString() };
}

export async function deletePage(scope: DayNoteScope, id: string): Promise<boolean> {
  const removed = await prisma.dayNotePage.deleteMany({ where: { id, ...where(scope) } });
  if (removed.count > 0) await prisma.noteVersion.deleteMany({ where: { ...where(scope), noteKey: `page:${id}` } });
  return removed.count > 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Pins
// ---------------------------------------------------------------------------------------------------------------

export type PinnedItem = { kind: "day"; day: string } | { kind: "page"; id: string; key: string; title: string };

export async function listPinned(scope: DayNoteScope): Promise<PinnedItem[]> {
  const [days, pages] = await Promise.all([
    prisma.dayNote.findMany({ where: { ...where(scope), pinned: true }, orderBy: { day: "desc" }, select: { day: true } }),
    prisma.dayNotePage.findMany({ where: { ...where(scope), pinned: true }, orderBy: { updatedAt: "desc" }, select: { id: true, key: true, title: true } }),
  ]);
  return [...days.map((d) => ({ kind: "day" as const, day: d.day })), ...pages.map((p) => ({ kind: "page" as const, id: p.id, key: p.key, title: p.title }))];
}

export async function setDayPinned(scope: DayNoteScope, day: string, pinned: boolean, actorName: string) {
  await prisma.dayNote.upsert({
    where: { scopeType_scopeId_day: { scopeType: scope.type, scopeId: scope.id, day } },
    create: { ...where(scope), day, content: "", authorName: actorName, pinned },
    update: { pinned },
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Personal templates
// ---------------------------------------------------------------------------------------------------------------

export const MAX_TEMPLATES = 30;
export const MAX_TEMPLATE_LENGTH = 50_000;

export async function listTemplates(userId: string) {
  return prisma.noteTemplate.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, content: true } });
}

export async function createTemplate(userId: string, name: string, content: string): Promise<{ id: string; name: string; content: string } | { error: string }> {
  if ((await prisma.noteTemplate.count({ where: { userId } })) >= MAX_TEMPLATES) return { error: `You can save up to ${MAX_TEMPLATES} templates. Delete one first.` };
  return prisma.noteTemplate.create({ data: { userId, name: name.slice(0, 60), content: content.slice(0, MAX_TEMPLATE_LENGTH) }, select: { id: true, name: true, content: true } });
}

export async function deleteTemplate(userId: string, id: string): Promise<boolean> {
  return (await prisma.noteTemplate.deleteMany({ where: { id, userId } })).count > 0;
}
