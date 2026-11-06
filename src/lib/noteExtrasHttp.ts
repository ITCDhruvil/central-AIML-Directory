import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { isValidDay, isValidPageKey } from "@/lib/dayDate";
import type { DayNoteScope } from "@/lib/dayNotes";
import { createPage, deletePage, getPage, getVersion, listPages, listPinned, listVersions, savePage, setDayPinned, MAX_PAGE_LENGTH } from "@/lib/noteExtras";

// Request handlers shared by the personal (/api/me/day-notes/...) and project (/api/projects/<id>/day-notes/...) routes.
// The route files resolve and authorize the scope first, then call these.

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function bodyOf(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** GET ?key=<day|week:day>: the pages for that day or week. */
export async function pagesList(scope: DayNoteScope, request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (!isValidPageKey(key)) return bad("key must be a day or week:day");
  return NextResponse.json({ pages: await listPages(scope, key) });
}

/** POST { key, title? } */
export async function pagesCreate(scope: DayNoteScope, request: NextRequest, actorName: string) {
  const body = await bodyOf(request);
  const key = typeof body?.key === "string" ? body.key : "";
  if (!isValidPageKey(key)) return bad("key must be a day or week:day");
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const page = await createPage(scope, key, title, actorName);
  return "error" in page ? bad(page.error) : NextResponse.json({ page });
}

export async function pageRead(scope: DayNoteScope, id: string) {
  const page = await getPage(scope, id);
  return page ? NextResponse.json({ page }) : bad("Page not found", 404);
}

/** PUT { content?, title?, pinned? } */
export async function pageUpdate(scope: DayNoteScope, id: string, request: NextRequest, actorName: string) {
  const body = await bodyOf(request);
  if (!body) return bad("Invalid JSON body");
  const change: { content?: string; title?: string; pinned?: boolean } = {};
  if (body.content !== undefined) {
    if (typeof body.content !== "string") return bad("content must be a string");
    if (body.content.length > MAX_PAGE_LENGTH) return bad("The page is too long.");
    change.content = body.content;
  }
  if (body.title !== undefined) {
    if (typeof body.title !== "string") return bad("title must be a string");
    change.title = body.title.trim();
  }
  if (body.pinned !== undefined) {
    if (typeof body.pinned !== "boolean") return bad("pinned must be true or false");
    change.pinned = body.pinned;
  }
  const page = await savePage(scope, id, change, actorName);
  return page ? NextResponse.json({ page }) : bad("Page not found", 404);
}

export async function pageRemove(scope: DayNoteScope, id: string) {
  return (await deletePage(scope, id)) ? new NextResponse(null, { status: 204 }) : bad("Page not found", 404);
}

/** GET ?key=<day|page:id>: restore points for a note. */
export async function versionsList(scope: DayNoteScope, request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (!isValidDay(key) && !/^page:[A-Za-z0-9]{10,40}$/.test(key)) return bad("key must be a day or page:id");
  return NextResponse.json({ versions: await listVersions(scope, key) });
}

export async function versionRead(scope: DayNoteScope, id: string) {
  const version = await getVersion(scope, id);
  return version ? NextResponse.json({ version }) : bad("Version not found", 404);
}

export async function pinnedList(scope: DayNoteScope) {
  return NextResponse.json({ pinned: await listPinned(scope) });
}

/** PUT { day, pinned } pins or unpins a day's main note. (Pages are pinned through their own PUT.) */
export async function pinnedSet(scope: DayNoteScope, request: NextRequest, actorName: string) {
  const body = await bodyOf(request);
  const day = typeof body?.day === "string" ? body.day : "";
  if (!isValidDay(day) || typeof body?.pinned !== "boolean") return bad("day and pinned are required");
  await setDayPinned(scope, day, body.pinned, actorName);
  return NextResponse.json({ ok: true });
}
