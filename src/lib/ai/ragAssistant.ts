import "server-only";
import type { Project } from "@/types/project";
import type { Documentation, DocumentCategory } from "@/types/documentation";
import type { AIConfig, AssistantAnswer, ContextDocument, GenerateFn } from "@/lib/ai/types";
import type { AssistantTurn } from "@/lib/ai/prompts";
import { answerFromContext, answerProjectQuestion } from "@/lib/ai/assistant";
import { embedQuery } from "@/lib/ai/embeddings";
import { projectHasIndex, retrieveChunks } from "@/lib/rag/search";

const TOP_K = 8;
// Chunks below this cosine score are dropped, so weakly-related noise doesn't crowd out the context (CRAG-lite).
const MIN_SCORE = 0.15;

/**
 * Answers a project question using RAG when the project has an index: embed the question, retrieve the most similar
 * chunks across every document (including uploaded files), and ground the answer in those. Falls back to the plain
 * whole-document assistant when there is no index yet, or if embedding/retrieval fails for any reason.
 */
export async function answerWithRag(
  project: Project,
  documents: Documentation[],
  question: string,
  config: AIConfig,
  generate: GenerateFn,
  history: AssistantTurn[] = [],
): Promise<AssistantAnswer> {
  try {
    if (await projectHasIndex(project.id)) {
      const queryVector = await embedQuery(question, config);
      const chunks = (await retrieveChunks(project.id, queryVector, TOP_K)).filter((c) => c.score >= MIN_SCORE);
      if (chunks.length > 0) {
        const meta = new Map(documents.map((d) => [d.id, d]));
        const contextDocs: ContextDocument[] = chunks.map((c) => {
          const doc = meta.get(c.documentId);
          return {
            documentId: c.documentId,
            title: doc?.title ?? "Document",
            category: (doc?.category ?? "OTHER") as DocumentCategory,
            content: c.content,
          };
        });
        // Retrieval trace (ids + scores) for observability, per the RAG playbook.
        console.log(`[rag] project=${project.id} q="${question.slice(0, 60)}" ->`, chunks.map((c) => `${c.documentId.slice(0, 6)}:${c.score.toFixed(3)}`).join(", "));
        return await answerFromContext(project, contextDocs, question, config, generate, history);
      }
      console.log(`[rag] project=${project.id} no chunks above ${MIN_SCORE}; falling back to full docs`);
    }
  } catch (error) {
    console.error("[rag] retrieval failed, falling back to full documents:", error instanceof Error ? error.message : error);
  }
  return answerProjectQuestion(project, documents, question, config, generate, history);
}
