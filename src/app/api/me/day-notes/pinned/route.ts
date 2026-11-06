import { NextRequest } from "next/server";
import { resolveUserScope } from "@/lib/dayNotesHttp";
import { pinnedList, pinnedSet } from "@/lib/noteExtrasHttp";

export async function GET() {
  const resolved = await resolveUserScope();
  if (!resolved.ok) return resolved.response;
  return pinnedList(resolved.scope);
}

export async function PUT(request: NextRequest) {
  const resolved = await resolveUserScope();
  if (!resolved.ok) return resolved.response;
  return pinnedSet(resolved.scope, request, resolved.actorName);
}
