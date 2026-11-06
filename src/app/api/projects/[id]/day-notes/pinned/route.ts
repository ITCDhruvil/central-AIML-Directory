import { NextRequest } from "next/server";
import { resolveProjectScope } from "@/lib/dayNotesHttp";
import { pinnedList, pinnedSet } from "@/lib/noteExtrasHttp";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const resolved = await resolveProjectScope(id, "view");
  if (!resolved.ok) return resolved.response;
  return pinnedList(resolved.scope);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const resolved = await resolveProjectScope(id, "edit");
  if (!resolved.ok) return resolved.response;
  return pinnedSet(resolved.scope, request, resolved.actorName);
}
