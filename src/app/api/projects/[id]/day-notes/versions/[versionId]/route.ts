import { NextRequest } from "next/server";
import { resolveProjectScope } from "@/lib/dayNotesHttp";
import { versionRead } from "@/lib/noteExtrasHttp";

type RouteParams = { params: Promise<{ id: string; versionId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id, versionId } = await params;
  const resolved = await resolveProjectScope(id, "view");
  if (!resolved.ok) return resolved.response;
  return versionRead(resolved.scope, versionId);
}
