import { guardedAi } from "@/lib/ai/guard";
import { apiAuthorize } from "@/lib/auth/dal";
import { NextRequest, NextResponse } from "next/server";
import { getDocumentationById } from "@/lib/documents";
import { getAIConfig } from "@/lib/ai/config";
import { callAssistantModel } from "@/lib/ai/client";
import { askDocument, DocAssistantError } from "@/lib/ai/docAssistant";
import { AIProviderError } from "@/lib/ai/types";

type RouteParams = { params: Promise<{ id: string; documentId: string }> };

const MAX_QUESTION = 500;

/**
 * Summarizes one document, or answers a question about it. Read-only: it never changes the document, and the browser
 * sends only a question (or asks for a summary) — the document text is loaded here, not sent up.
 */
async function handlePost(request: NextRequest, { params }: RouteParams) {
  const auth = await apiAuthorize("documents", "view");
  if (!auth.ok) return auth.response;

  const { id, documentId } = await params;
  const document = await getDocumentationById(id, documentId, auth.access);
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (!document.content.trim()) {
    return NextResponse.json({ error: "This document has no text to read. Uploaded files can't be analyzed here." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const data = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const rawQuestion = typeof data.question === "string" ? data.question.trim() : "";
  if (rawQuestion.length > MAX_QUESTION) {
    return NextResponse.json({ error: `question must be ${MAX_QUESTION} characters or fewer` }, { status: 400 });
  }
  // No question = summarize.
  const question = rawQuestion || null;

  const config = getAIConfig();
  if (!config) {
    return NextResponse.json({ error: "AI tools are not configured." }, { status: 503 });
  }

  try {
    const answer = await askDocument(
      { title: document.title, category: document.category, content: document.content, question },
      config,
      callAssistantModel,
    );
    return NextResponse.json({ answer });
  } catch (error) {
    if (error instanceof AIProviderError || error instanceof DocAssistantError) {
      console.error("POST .../documents/[documentId]/ask AI error", error.message);
      return NextResponse.json({ error: "The AI tool is temporarily unavailable. Please try again." }, { status: 502 });
    }
    console.error("POST .../documents/[documentId]/ask failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export const POST = guardedAi("ai_project_assistant", handlePost);
