import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/projects";
import { listDocumentation } from "@/lib/documents";
import { ValidationError, validateAssistantQuestion } from "@/lib/validation";
import { getAIConfig } from "@/lib/ai/config";
import { callAssistantModel } from "@/lib/ai/client";
import { answerProjectQuestion, AssistantResponseError } from "@/lib/ai/assistant";
import { AIProviderError } from "@/lib/ai/types";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Read-only project knowledge assistant. Loads only this project's own data,
 * never modifies anything, and never forwards raw document content back to
 * the browser as input — the browser sends only the question.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const project = await getProjectById(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let question: string;
  try {
    question = validateAssistantQuestion(body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    throw error;
  }

  const config = getAIConfig();
  if (!config) {
    return NextResponse.json(
      { error: "The project assistant is not configured. Set OPENAI_API_KEY to enable it." },
      { status: 503 },
    );
  }

  try {
    const documents = await listDocumentation(project.id);
    const result = await answerProjectQuestion(project, documents, question, config, callAssistantModel);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AIProviderError) {
      console.error("POST /api/projects/[id]/assistant provider error", error.message);
      return NextResponse.json(
        { error: "The assistant is temporarily unavailable. Please try again." },
        { status: 502 },
      );
    }
    if (error instanceof AssistantResponseError) {
      console.error("POST /api/projects/[id]/assistant malformed response", error.message);
      return NextResponse.json(
        { error: "The assistant is temporarily unavailable. Please try again." },
        { status: 502 },
      );
    }
    console.error("POST /api/projects/[id]/assistant failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Failed to answer the question" }, { status: 500 });
  }
}
