import type { Project } from "@/types/project";
import type { Documentation } from "@/types/documentation";
import { buildProjectContext } from "@/lib/ai/contextBuilder";
import { ASSISTANT_SYSTEM_PROMPT, buildAssistantUserMessage, type AssistantTurn } from "@/lib/ai/prompts";
import { parseAssistantResponse } from "@/lib/ai/responseValidator";
import { resolveCitations } from "@/lib/ai/citations";
import type { AIConfig, AssistantAnswer, ContextDocument, GenerateFn } from "@/lib/ai/types";

export class AssistantResponseError extends Error {}

/**
 * The whole "Project Knowledge Loader -> Context Builder -> AI Client ->
 * Response Validator -> Citation Validator" pipeline in one orchestration
 * function. `generate` is injected (never imported directly) so this is
 * fully testable with a fake model response and no network access — the
 * route handler is the only caller that passes the real provider call.
 */
export async function answerProjectQuestion(
  project: Project,
  documents: Documentation[],
  question: string,
  config: AIConfig,
  generate: GenerateFn,
  history: AssistantTurn[] = [],
): Promise<AssistantAnswer> {
  return answerFromContext(
    project,
    documents.map((d) => ({ documentId: d.id, title: d.title, category: d.category, content: d.content })),
    question,
    config,
    generate,
    history,
  );
}

/**
 * The shared core: given already-selected context documents (whole docs, or retrieved RAG chunks), build the context,
 * ask the model and resolve citations. Both the plain and the RAG path go through here, so citations never diverge.
 */
export async function answerFromContext(
  project: Project,
  contextDocs: ContextDocument[],
  question: string,
  config: AIConfig,
  generate: GenerateFn,
  history: AssistantTurn[] = [],
): Promise<AssistantAnswer> {
  const built = buildProjectContext(contextDocs);
  const userMessage = buildAssistantUserMessage(project, built, question, history);
  const raw = await generate(ASSISTANT_SYSTEM_PROMPT, userMessage, config);

  const parsed = parseAssistantResponse(raw);
  if (!parsed) {
    throw new AssistantResponseError("The assistant returned a response that could not be understood");
  }

  return {
    answer: parsed.answer,
    citations: resolveCitations(parsed.citationLabels, built.sources),
  };
}
