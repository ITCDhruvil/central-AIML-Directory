import { guardedAi } from "@/lib/ai/guard";
import { apiAuthorize, denyUnlessFullAccess } from "@/lib/auth/dal";
import { NextResponse } from "next/server";
import { listActivitiesSince } from "@/lib/projectActivity";
import { getAIConfig } from "@/lib/ai/config";
import { callAssistantModel } from "@/lib/ai/client";
import { writeDigest, DigestError } from "@/lib/ai/digest";
import { AIProviderError } from "@/lib/ai/types";

const DAYS = 7;
const MAX_EVENTS = 200;

/**
 * An AI-written weekly update of what changed across the directory in the last 7 days, from the activity log.
 * Directory-wide, so it needs full access (same rule as insights). Never changes anything.
 */
async function handlePost() {
  const auth = await apiAuthorize("insights", "view");
  if (!auth.ok) return auth.response;
  const denied = denyUnlessFullAccess(auth);
  if (denied) return denied;

  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  const events = await listActivitiesSince(since, auth.access, MAX_EVENTS);
  if (events.length === 0) {
    return NextResponse.json({ summary: "Nothing has changed across the directory in the last 7 days.", count: 0 });
  }

  const config = getAIConfig();
  if (!config) return NextResponse.json({ error: "AI tools are not configured." }, { status: 503 });

  try {
    const summary = await writeDigest(events, DAYS, config, callAssistantModel);
    return NextResponse.json({ summary, count: events.length });
  } catch (error) {
    if (error instanceof AIProviderError || error instanceof DigestError) {
      console.error("POST /api/digest AI error", error.message);
      return NextResponse.json({ error: "The digest is temporarily unavailable. Please try again." }, { status: 502 });
    }
    console.error("POST /api/digest failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export const POST = guardedAi("ai_insights", handlePost);
