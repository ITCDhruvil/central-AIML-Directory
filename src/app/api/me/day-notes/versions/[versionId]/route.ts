import { NextRequest } from "next/server";
import { resolveUserScope } from "@/lib/dayNotesHttp";
import { versionRead } from "@/lib/noteExtrasHttp";

type RouteParams = { params: Promise<{ versionId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { versionId } = await params;
  const resolved = await resolveUserScope();
  if (!resolved.ok) return resolved.response;
  return versionRead(resolved.scope, versionId);
}
