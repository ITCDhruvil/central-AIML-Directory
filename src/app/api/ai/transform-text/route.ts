import { NextRequest, NextResponse } from "next/server";
import { getAIConfig } from "@/lib/ai/config";
import { callAssistantModel } from "@/lib/ai/client";
import { transformText, TextTransformResponseError } from "@/lib/ai/textTransform";
import {
  TEXT_TRANSFORM_ACTIONS,
  TEXT_TRANSFORM_LANGUAGES,
  TEXT_TRANSFORM_TONES,
  type TextTransformAction,
  type TextTransformLanguage,
  type TextTransformTone,
} from "@/lib/ai/textTransformPrompts";
import { AIProviderError } from "@/lib/ai/types";

const MAX_INPUT_LENGTH = 8000;

/**
 * Rewrites the text a rich text editor's toolbar sends it — opt-in, one
 * click per call, never touches any project record itself. The caller
 * (e.g. RichTextEditor's AI menu) applies the result to its own field.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }
  const data = body as Record<string, unknown>;

  const text = typeof data.text === "string" ? data.text : "";
  if (!text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (text.length > MAX_INPUT_LENGTH) {
    return NextResponse.json({ error: `text must be ${MAX_INPUT_LENGTH} characters or fewer` }, { status: 400 });
  }

  const action = typeof data.action === "string" ? data.action : "";
  if (!TEXT_TRANSFORM_ACTIONS.includes(action as TextTransformAction)) {
    return NextResponse.json({ error: `action must be one of ${TEXT_TRANSFORM_ACTIONS.join(", ")}` }, { status: 400 });
  }

  let tone: TextTransformTone | undefined;
  if (action === "tone") {
    if (typeof data.tone !== "string" || !TEXT_TRANSFORM_TONES.includes(data.tone as TextTransformTone)) {
      return NextResponse.json({ error: `tone must be one of ${TEXT_TRANSFORM_TONES.join(", ")}` }, { status: 400 });
    }
    tone = data.tone as TextTransformTone;
  }

  let language: TextTransformLanguage | undefined;
  if (action === "translate") {
    if (typeof data.language !== "string" || !TEXT_TRANSFORM_LANGUAGES.includes(data.language as TextTransformLanguage)) {
      return NextResponse.json({ error: `language must be one of ${TEXT_TRANSFORM_LANGUAGES.join(", ")}` }, { status: 400 });
    }
    language = data.language as TextTransformLanguage;
  }

  const config = getAIConfig();
  if (!config) {
    return NextResponse.json(
      { error: "AI text tools are not configured. Set the AI API key to enable them." },
      { status: 503 },
    );
  }

  try {
    const result = await transformText(
      { action: action as TextTransformAction, tone, language, text },
      config,
      callAssistantModel,
    );
    return NextResponse.json({ text: result });
  } catch (error) {
    if (error instanceof AIProviderError) {
      console.error("POST /api/ai/transform-text provider error", error.message);
      return NextResponse.json(
        { error: "The AI text tool is temporarily unavailable. Please try again." },
        { status: 502 },
      );
    }
    if (error instanceof TextTransformResponseError) {
      console.error("POST /api/ai/transform-text malformed response", error.message);
      return NextResponse.json(
        { error: "The AI text tool is temporarily unavailable. Please try again." },
        { status: 502 },
      );
    }
    console.error("POST /api/ai/transform-text failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to transform text" }, { status: 500 });
  }
}
