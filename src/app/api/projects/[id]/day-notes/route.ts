import { NextRequest } from "next/server";
import { monthDaysResponse, resolveProjectScope } from "@/lib/dayNotesHttp";

type RouteParams = { params: Promise<{ id: string }> };

/** Which days in a month have an entry in this project's shared day log. Query: ?month=YYYY-MM. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const resolved = await resolveProjectScope(id, "view");
  if (!resolved.ok) return resolved.response;
  return monthDaysResponse(resolved.scope, request);
}
