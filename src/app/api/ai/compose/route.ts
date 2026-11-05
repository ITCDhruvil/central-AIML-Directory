import { guardedAi } from "@/lib/ai/guard";
import { getCurrentUser } from "@/lib/auth/dal";
import { NextRequest, NextResponse } from "next/server";
import { getAIConfig } from "@/lib/ai/config";
import { callAssistantModel } from "@/lib/ai/client";
import { compose, ComposeError, COMPOSE_ACTIONS, type ComposeAction } from "@/lib/ai/compose";
import { AIProviderError } from "@/lib/ai/types";

const MAX_PROMPT = 2000;
const MAX_TEXT = 12000;

/** Writes new content from a prompt, continues existing text, or rewrites a selection per an instruction. */
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
  if (typeof action !== "string" || !(COMPOSE_ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ error: `action must be one of ${COMPOSE_ACTIONS.join(", ")}` }, { status: 400 });
  }
  const prompt = typeof data.prompt === "string" ? data.prompt.trim() : "";
  const text = typeof data.text === "string" ? data.text : "";
  if ((action === "write" || action === "custom") && !prompt) {
    return NextResponse.json({ error: "A prompt is required." }, { status: 400 });
  }
  if ((action === "continue" || action === "custom") && !text.trim()) {
    return NextResponse.json({ error: "There is no text to work with." }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT) return NextResponse.json({ error: `The prompt must be ${MAX_PROMPT} characters or fewer.` }, { status: 400 });
  if (text.length > MAX_TEXT) return NextResponse.json({ error: `The text must be ${MAX_TEXT} characters or fewer.` }, { status: 400 });

  const config = getAIConfig();
  if (!config) return NextResponse.json({ error: "AI tools are not configured." }, { status: 503 });

  try {
    const result = await compose({ action: action as ComposeAction, prompt, text }, config, callAssistantModel);
    return NextResponse.json({ text: result });
  } catch (error) {
    if (error instanceof AIProviderError || error instanceof ComposeError) {
      console.error("POST /api/ai/compose AI error", error.message);
      return NextResponse.json({ error: "The AI tool is temporarily unavailable. Please try again." }, { status: 502 });
    }
    console.error("POST /api/ai/compose failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export const POST = guardedAi("ai_text_transform", handlePost);
