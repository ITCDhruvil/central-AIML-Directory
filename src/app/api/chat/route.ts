import { NextRequest, NextResponse } from "next/server";
import { getAIConfig } from "@/lib/ai/config";
import { callAssistantModelWithTools } from "@/lib/ai/client";
import { runChatbotTurn } from "@/lib/ai/chatbot";
import { CHATBOT_TOOLS, CHATBOT_TOOL_HANDLERS } from "@/lib/ai/chatbotTools";
import { AIProviderError } from "@/lib/ai/types";
import { ValidationError, validateChatMessages } from "@/lib/validation";

/**
 * Global chatbot turn — carries the full conversation (the browser re-sends
 * everything each time; nothing is persisted server-side), runs the
 * tool-calling loop against real project data, and returns only the new
 * messages produced this turn for the browser to append to its own history.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let messages;
  try {
    messages = validateChatMessages(body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    throw error;
  }

  const config = getAIConfig();
  if (!config) {
    return NextResponse.json(
      { error: "The chatbot is not configured. Set the AI API key to enable it." },
      { status: 503 },
    );
  }

  try {
    const newMessages = await runChatbotTurn(messages, config, callAssistantModelWithTools, CHATBOT_TOOLS, CHATBOT_TOOL_HANDLERS);
    return NextResponse.json({ messages: newMessages });
  } catch (error) {
    if (error instanceof AIProviderError) {
      console.error("POST /api/chat provider error", error.message);
      return NextResponse.json({ error: "The chatbot is temporarily unavailable. Please try again." }, { status: 502 });
    }
    console.error("POST /api/chat failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to process the message" }, { status: 500 });
  }
}
