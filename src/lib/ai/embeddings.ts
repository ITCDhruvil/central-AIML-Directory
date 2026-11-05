import "server-only";
import { AIProviderError, type AIConfig } from "@/lib/ai/types";
import { recordModelCall } from "@/lib/ai/usageContext";

const EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

/** The embedding model, overridable via env. Changing it changes the index hash, so documents get re-embedded. */
export const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";

// Keep each request's payload modest; OpenAI accepts arrays, we batch to be safe.
const BATCH = 64;
const MAX_INPUT_CHARS = 8000;

/** Embeds a list of texts, in batches, returning one vector per input in order. Token use is recorded for cost tracking. */
export async function embedTexts(texts: string[], config: AIConfig): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH).map((t) => t.slice(0, MAX_INPUT_CHARS));
    let res: Response;
    try {
      res = await fetch(EMBEDDINGS_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
      });
    } catch {
      throw new AIProviderError("Failed to reach the embeddings provider");
    }
    if (!res.ok) throw new AIProviderError(`Embeddings request failed with status ${res.status}`);
    const data = (await res.json()) as { data?: { embedding?: number[] }[]; usage?: { prompt_tokens?: unknown } };
    recordModelCall({ prompt_tokens: data.usage?.prompt_tokens, completion_tokens: 0 }, EMBEDDING_MODEL);
    const vectors = data.data?.map((d) => d.embedding);
    if (!vectors || vectors.length !== batch.length || vectors.some((v) => !Array.isArray(v))) {
      throw new AIProviderError("Embeddings response had an unexpected shape");
    }
    out.push(...(vectors as number[][]));
  }
  return out;
}

export async function embedQuery(text: string, config: AIConfig): Promise<number[]> {
  const [vector] = await embedTexts([text], config);
  return vector;
}
