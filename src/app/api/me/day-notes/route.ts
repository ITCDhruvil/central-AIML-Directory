import { NextRequest } from "next/server";
import { monthDaysResponse, resolveUserScope } from "@/lib/dayNotesHttp";

/** Which days in a month have a personal note. Query: ?month=YYYY-MM. */
export async function GET(request: NextRequest) {
  const resolved = await resolveUserScope();
  if (!resolved.ok) return resolved.response;
  return monthDaysResponse(resolved.scope, request);
}
