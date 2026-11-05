import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { apiAuthorize } from "@/lib/auth/dal";
import { getProjectById } from "@/lib/projects";
import { isValidDay, isValidMonth } from "@/lib/dayDate";
import { getDayNote, listMonthDays, saveDayNote, MAX_DAY_NOTE_LENGTH, type DayNoteScope } from "@/lib/dayNotes";

type Resolved = { ok: true; scope: DayNoteScope; actorName: string } | { ok: false; response: NextResponse };

/** Personal notes: any signed-in user, scoped to themselves. */
export async function resolveUserScope(): Promise<Resolved> {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) {
    return { ok: false, response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }
  return { ok: true, scope: { type: "USER", id: user.id }, actorName: user.name };
}

/** Project notes: `need` is "view" to read or "edit" to write; the project must be visible to the caller. */
export async function resolveProjectScope(projectId: string, need: "view" | "edit"): Promise<Resolved> {
  const auth = await apiAuthorize("projects", need);
  if (!auth.ok) return { ok: false, response: auth.response };
  const project = await getProjectById(projectId, auth.access);
  if (!project) return { ok: false, response: NextResponse.json({ error: "Project not found" }, { status: 404 }) };
  return { ok: true, scope: { type: "PROJECT", id: projectId }, actorName: auth.user.name };
}

export async function monthDaysResponse(scope: DayNoteScope, request: NextRequest): Promise<NextResponse> {
  const month = request.nextUrl.searchParams.get("month") ?? "";
  if (!isValidMonth(month)) return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  return NextResponse.json({ days: await listMonthDays(scope, month) });
}

export async function getDayResponse(scope: DayNoteScope, day: string): Promise<NextResponse> {
  if (!isValidDay(day)) return NextResponse.json({ error: "Invalid day" }, { status: 400 });
  return NextResponse.json({ note: await getDayNote(scope, day) });
}

export async function saveDayResponse(scope: DayNoteScope, day: string, request: NextRequest, actorName: string): Promise<NextResponse> {
  if (!isValidDay(day)) return NextResponse.json({ error: "Invalid day" }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const content = typeof body === "object" && body !== null ? (body as Record<string, unknown>).content : undefined;
  if (typeof content !== "string") return NextResponse.json({ error: "content must be a string" }, { status: 400 });
  if (content.length > MAX_DAY_NOTE_LENGTH) {
    return NextResponse.json({ error: `The note is too long (limit ${Math.round(MAX_DAY_NOTE_LENGTH / 1000)}k characters).` }, { status: 400 });
  }
  return NextResponse.json({ note: await saveDayNote(scope, day, content, actorName) });
}
