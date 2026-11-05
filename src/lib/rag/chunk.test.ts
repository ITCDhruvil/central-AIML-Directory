import { test } from "node:test";
import assert from "node:assert/strict";
import { approxTokens, chunkText, normalizeText } from "@/lib/rag/chunk";
import { cosineSimilarity, topK } from "@/lib/rag/vector";

test("normalizes whitespace and newlines", () => {
  assert.equal(normalizeText("a\r\n\r\n\r\nb  c  "), "a\n\nb c");
});

test("keeps a short Markdown section as one chunk and splits by heading", () => {
  const chunks = chunkText("# A\nalpha text\n\n# B\nbeta text");
  assert.equal(chunks.length, 2);
  assert.match(chunks[0], /# A/);
  assert.match(chunks[1], /# B/);
});

test("splits a long section into overlapping chunks under the cap", () => {
  const long = Array.from({ length: 50 }, (_, i) => `line ${i} with some words here`).join("\n");
  const chunks = chunkText(long, 300, 60);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length <= 320));
});

test("empty text yields no chunks", () => {
  assert.deepEqual(chunkText("   \n  "), []);
  assert.ok(approxTokens("abcd") >= 1);
});

test("cosine similarity and topK rank the nearest vectors", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  const ranked = topK([1, 0], [{ item: "far", vector: [0, 1] }, { item: "near", vector: [0.9, 0.1] }], 1);
  assert.equal(ranked[0].item, "near");
});
