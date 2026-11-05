import { NextRequest } from "next/server";
import { guardedAi } from "@/lib/ai/guard";
import { resolveUserScope, weekSummaryResponse } from "@/lib/dayNotesHttp";

/** AI summary of your last 7 days of personal notes. */
export const POST = guardedAi("ai_project_assistant", async (request: NextRequest) => {
  const resolved = await resolveUserScope();
  if (!resolved.ok) return resolved.response;
  return weekSummaryResponse(resolved.scope, request);
});
