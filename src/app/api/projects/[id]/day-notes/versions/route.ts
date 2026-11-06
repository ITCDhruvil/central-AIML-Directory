import { NextRequest } from "next/server";
import { resolveProjectScope } from "@/lib/dayNotesHttp";
import { versionsList } from "@/lib/noteExtrasHttp";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const resolved = await resolveProjectScope(id, "view");
  if (!resolved.ok) return resolved.response;
  return versionsList(resolved.scope, request);
}
