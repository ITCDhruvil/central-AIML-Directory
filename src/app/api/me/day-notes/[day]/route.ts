import { NextRequest } from "next/server";
import { getDayResponse, resolveUserScope, saveDayResponse } from "@/lib/dayNotesHttp";

type RouteParams = { params: Promise<{ day: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const resolved = await resolveUserScope();
  if (!resolved.ok) return resolved.response;
  const { day } = await params;
  return getDayResponse(resolved.scope, day);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const resolved = await resolveUserScope();
  if (!resolved.ok) return resolved.response;
  const { day } = await params;
  return saveDayResponse(resolved.scope, day, request, resolved.actorName);
}
