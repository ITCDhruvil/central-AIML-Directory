import { NextRequest } from "next/server";
import { guardedAi } from "@/lib/ai/guard";
import { resolveProjectScope, weekSummaryResponse } from "@/lib/dayNotesHttp";

type RouteParams = { params: Promise<{ id: string }> };

/** AI summary of the project's last 7 days of daily log entries. */
export const POST = guardedAi("ai_project_assistant", async (request: NextRequest, { params }: RouteParams) => {
  const { id } = await params;
  const resolved = await resolveProjectScope(id, "view");
  if (!resolved.ok) return resolved.response;
  return weekSummaryResponse(resolved.scope, request);
});
