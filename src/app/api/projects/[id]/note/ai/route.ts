import { guardedAi } from "@/lib/ai/guard";
import { apiAuthorize } from "@/lib/auth/dal";
import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/projects";
import { getAIConfig } from "@/lib/ai/config";
import { callAssistantModel } from "@/lib/ai/client";
import { runNoteAi, NoteAiError, NOTE_AI_ACTIONS, type NoteAiAction } from "@/lib/ai/noteAi";
import { AIProviderError } from "@/lib/ai/types";

type RouteParams = { params: Promise<{ id: string }> };

const MAX_INPUT = 16000;

/** Runs an AI task on a project's notes (summarize, action items, key points, cleanup). Returns Markdown; never saves. */
async function handlePost(request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("projects", "edit");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const project = await getProjectById(id, auth.access);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

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
  if (!text.trim()) return NextResponse.json({ error: "There are no notes to work with yet." }, { status: 400 });
  if (text.length > MAX_INPUT) return NextResponse.json({ error: `Notes must be ${MAX_INPUT} characters or fewer.` }, { status: 400 });

  const config = getAIConfig();
  if (!config) return NextResponse.json({ error: "AI tools are not configured." }, { status: 503 });

  try {
    const result = await runNoteAi(action as NoteAiAction, text, config, callAssistantModel);
    return NextResponse.json({ text: result });
  } catch (error) {
    if (error instanceof AIProviderError || error instanceof NoteAiError) {
      console.error("POST /api/projects/[id]/note/ai AI error", error.message);
      return NextResponse.json({ error: "The AI tool is temporarily unavailable. Please try again." }, { status: 502 });
    }
    console.error("POST /api/projects/[id]/note/ai failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export const POST = guardedAi("ai_text_transform", handlePost);
