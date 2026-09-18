import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInsightsResponse } from "@/lib/ai/insightsValidator";

const VALID_ITEM = {
  type: "improvement",
  title: "Add pgvector for semantic search",
  reasoning: "The project already stores unstructured text and pgvector is a mature, well-supported extension for it.",
  suggestedTool: "pgvector",
  relatedProjectName: "SKODA-forecasting-POC",
  sourceUrls: ["https://example.com/pgvector"],
};

test("parses a well-formed array", () => {
  const parsed = parseInsightsResponse(JSON.stringify([VALID_ITEM]));
  assert.deepEqual(parsed, [VALID_ITEM]);
});

test("unwraps a markdown code fence around the JSON", () => {
  const raw = "```json\n" + JSON.stringify([VALID_ITEM]) + "\n```";
  const parsed = parseInsightsResponse(raw);
  assert.deepEqual(parsed, [VALID_ITEM]);
});

test("rejects non-JSON and non-array input", () => {
  assert.equal(parseInsightsResponse("not json"), null);
  assert.equal(parseInsightsResponse(JSON.stringify({ not: "an array" })), null);
});

test("drops individual items missing required fields instead of failing the whole batch", () => {
  const parsed = parseInsightsResponse(JSON.stringify([VALID_ITEM, { type: "improvement" }, { title: "no type" }]));
  assert.deepEqual(parsed, [VALID_ITEM]);
});

test("rejects an item with an invalid type", () => {
  const parsed = parseInsightsResponse(JSON.stringify([{ ...VALID_ITEM, type: "something_else" }]));
  assert.equal(parsed, null);
});

test("defaults optional fields to null/empty when absent", () => {
  const minimal = { type: "new_idea", title: "Title", reasoning: "Reasoning here." };
  const parsed = parseInsightsResponse(JSON.stringify([minimal]));
  assert.deepEqual(parsed, [{ type: "new_idea", title: "Title", reasoning: "Reasoning here.", suggestedTool: null, relatedProjectName: null, sourceUrls: [] }]);
});

test("caps the number of suggestions and source URLs", () => {
  const many = Array.from({ length: 15 }, (_, i) => ({ ...VALID_ITEM, title: `Item ${i}` }));
  const parsed = parseInsightsResponse(JSON.stringify(many));
  assert.equal(parsed?.length, 10);

  const manyUrls = { ...VALID_ITEM, sourceUrls: ["a", "b", "c", "d", "e"] };
  const parsedUrls = parseInsightsResponse(JSON.stringify([manyUrls]));
  assert.equal(parsedUrls?.[0].sourceUrls.length, 3);
});

test("returns null when every item is malformed", () => {
  assert.equal(parseInsightsResponse(JSON.stringify([{ type: "improvement" }, {}])), null);
});
