import { NextRequest } from "next/server";
import { resolveUserScope } from "@/lib/dayNotesHttp";
import { versionsList } from "@/lib/noteExtrasHttp";

export async function GET(request: NextRequest) {
  const resolved = await resolveUserScope();
  if (!resolved.ok) return resolved.response;
  return versionsList(resolved.scope, request);
}
