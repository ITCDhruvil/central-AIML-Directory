import { guardedAi } from "@/lib/ai/guard";
import { getCurrentUser } from "@/lib/auth/dal";
import { NextRequest, NextResponse } from "next/server";
import { getAIConfig } from "@/lib/ai/config";
import { callAssistantModel } from "@/lib/ai/client";
import { runNoteAi, NoteAiError, NOTE_AI_ACTIONS, type NoteAiAction } from "@/lib/ai/noteAi";
import { AIProviderError } from "@/lib/ai/types";

const MAX_INPUT = 16000;

/** Runs a note AI task (summarize, action items, key points, cleanup) on any text the caller holds. Returns Markdown. */
async function handlePost(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const data = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const action = data.action;
  if (typeof action !== "string" || !(NOTE_AI_ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ error: `action must be one of ${NOTE_AI_ACTIONS.join(", ")}` }, { status: 400 });
  }
  const text = typeof data.text === "string" ? data.text : "";
  if (!text.trim()) return NextResponse.json({ error: "There is nothing to work with yet." }, { status: 400 });
  if (text.length > MAX_INPUT) return NextResponse.json({ error: `Text must be ${MAX_INPUT} characters or fewer.` }, { status: 400 });

  const config = getAIConfig();
  if (!config) return NextResponse.json({ error: "AI tools are not configured." }, { status: 503 });

  try {
    const result = await runNoteAi(action as NoteAiAction, text, config, callAssistantModel);
    return NextResponse.json({ text: result });
  } catch (error) {
    if (error instanceof AIProviderError || error instanceof NoteAiError) {
      console.error("POST /api/ai/note-tools AI error", error.message);
      return NextResponse.json({ error: "The AI tool is temporarily unavailable. Please try again." }, { status: 502 });
    }
    console.error("POST /api/ai/note-tools failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export const POST = guardedAi("ai_text_transform", handlePost);
