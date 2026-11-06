import { NextRequest } from "next/server";
import { resolveProjectScope } from "@/lib/dayNotesHttp";
import { pageRead, pageRemove, pageUpdate } from "@/lib/noteExtrasHttp";

type RouteParams = { params: Promise<{ id: string; pageId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id, pageId } = await params;
  const resolved = await resolveProjectScope(id, "view");
  if (!resolved.ok) return resolved.response;
  return pageRead(resolved.scope, pageId);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id, pageId } = await params;
  const resolved = await resolveProjectScope(id, "edit");
  if (!resolved.ok) return resolved.response;
  return pageUpdate(resolved.scope, pageId, request, resolved.actorName);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id, pageId } = await params;
  const resolved = await resolveProjectScope(id, "edit");
  if (!resolved.ok) return resolved.response;
  return pageRemove(resolved.scope, pageId);
}
