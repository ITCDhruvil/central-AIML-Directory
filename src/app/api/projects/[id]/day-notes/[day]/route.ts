import { NextRequest } from "next/server";
import { getDayResponse, resolveProjectScope, saveDayResponse } from "@/lib/dayNotesHttp";

type RouteParams = { params: Promise<{ id: string; day: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id, day } = await params;
  const resolved = await resolveProjectScope(id, "view");
  if (!resolved.ok) return resolved.response;
  return getDayResponse(resolved.scope, day);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id, day } = await params;
  const resolved = await resolveProjectScope(id, "edit");
  if (!resolved.ok) return resolved.response;
  return saveDayResponse(resolved.scope, day, request, resolved.actorName);
}
