import { NextRequest } from "next/server";
import { resolveProjectScope } from "@/lib/dayNotesHttp";
import { pagesCreate, pagesList } from "@/lib/noteExtrasHttp";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const resolved = await resolveProjectScope(id, "view");
  if (!resolved.ok) return resolved.response;
  return pagesList(resolved.scope, request);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const resolved = await resolveProjectScope(id, "edit");
  if (!resolved.ok) return resolved.response;
  return pagesCreate(resolved.scope, request, resolved.actorName);
}
