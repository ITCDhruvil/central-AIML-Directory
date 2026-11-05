// Pure vector math for brute-force retrieval. The per-project corpus is small, so cosine over stored vectors in Node is
// enough; pgvector/HNSW is the scale path when a project's chunk count grows large.

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/** Top-k items by cosine similarity to `query`, each with its score, highest first. */
export function topK<T>(query: number[], items: { item: T; vector: number[] }[], k: number): { item: T; score: number }[] {
  return items
    .map(({ item, vector }) => ({ item, score: cosineSimilarity(query, vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
