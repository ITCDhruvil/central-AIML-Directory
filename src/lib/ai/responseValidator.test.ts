import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAssistantResponse } from "@/lib/ai/responseValidator";

test("parses a well-formed model response", () => {
  const result = parseAssistantResponse('{"answer": "It uses Next.js.", "citations": ["DOC-1", "DOC-2"]}');
  assert.deepEqual(result, { answer: "It uses Next.js.", citationLabels: ["DOC-1", "DOC-2"] });
});

test("accepts an empty citations array", () => {
  const result = parseAssistantResponse('{"answer": "Not available in project documentation.", "citations": []}');
  assert.deepEqual(result, { answer: "Not available in project documentation.", citationLabels: [] });
});

test("rejects non-JSON output", () => {
  assert.equal(parseAssistantResponse("The answer is: Next.js"), null);
});

test("rejects JSON that isn't an object", () => {
  assert.equal(parseAssistantResponse("42"), null);
  assert.equal(parseAssistantResponse("[1,2,3]"), null);
});

test("rejects a missing or empty answer field", () => {
  assert.equal(parseAssistantResponse('{"citations": []}'), null);
  assert.equal(parseAssistantResponse('{"answer": "", "citations": []}'), null);
  assert.equal(parseAssistantResponse('{"answer": "   ", "citations": []}'), null);
  assert.equal(parseAssistantResponse('{"answer": 42, "citations": []}'), null);
});

test("rejects a missing or malformed citations field", () => {
  assert.equal(parseAssistantResponse('{"answer": "ok"}'), null);
  assert.equal(parseAssistantResponse('{"answer": "ok", "citations": "DOC-1"}'), null);
  assert.equal(parseAssistantResponse('{"answer": "ok", "citations": [1, 2]}'), null);
});

test("rejects citation labels that don't match the DOC-n format, e.g. an invented or forged label", () => {
  assert.equal(parseAssistantResponse('{"answer": "ok", "citations": ["FORGED"]}'), null);
  assert.equal(parseAssistantResponse('{"answer": "ok", "citations": ["doc-1"]}'), null);
  assert.equal(parseAssistantResponse('{"answer": "ok", "citations": ["DOC-1; DROP TABLE"]}'), null);
});
