import { NextRequest } from "next/server";
import { resolveUserScope } from "@/lib/dayNotesHttp";
import { pagesCreate, pagesList } from "@/lib/noteExtrasHttp";

export async function GET(request: NextRequest) {
  const resolved = await resolveUserScope();
  if (!resolved.ok) return resolved.response;
  return pagesList(resolved.scope, request);
}

export async function POST(request: NextRequest) {
  const resolved = await resolveUserScope();
  if (!resolved.ok) return resolved.response;
  return pagesCreate(resolved.scope, request, resolved.actorName);
}
