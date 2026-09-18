import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCitations } from "@/lib/ai/citations";
import type { ContextSource } from "@/lib/ai/types";

const sources: ContextSource[] = [
  { label: "DOC-1", documentId: "d1", title: "README", category: "README" },
  { label: "DOC-2", documentId: "d2", title: "Architecture", category: "ARCHITECTURE" },
];

test("resolves labels the model returned to their real document metadata", () => {
  const result = resolveCitations(["DOC-1"], sources);
  assert.deepEqual(result, [{ documentId: "d1", title: "README", category: "README" }]);
});

test("discards a citation label that was never part of the supplied context (hallucinated / forged)", () => {
  const result = resolveCitations(["DOC-1", "DOC-99"], sources);
  assert.deepEqual(result, [{ documentId: "d1", title: "README", category: "README" }]);
});

test("returns nothing when every requested label is invalid", () => {
  assert.deepEqual(resolveCitations(["DOC-99"], sources), []);
});

test("returns an empty list when the model cites nothing", () => {
  assert.deepEqual(resolveCitations([], sources), []);
});

test("dedupes a label the model listed more than once", () => {
  const result = resolveCitations(["DOC-1", "DOC-1"], sources);
  assert.equal(result.length, 1);
});

test("orders results by the source map, not by the model's citation order", () => {
  const result = resolveCitations(["DOC-2", "DOC-1"], sources);
  assert.deepEqual(
    result.map((c) => c.documentId),
    ["d1", "d2"],
  );
});
