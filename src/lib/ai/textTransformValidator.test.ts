import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTextTransformResponse } from "@/lib/ai/textTransformValidator";

test("parses a well-formed response", () => {
  const parsed = parseTextTransformResponse(JSON.stringify({ text: "  Improved text.  " }));
  assert.deepEqual(parsed, { text: "Improved text." });
});

test("rejects non-JSON output", () => {
  assert.equal(parseTextTransformResponse("not json"), null);
});

test("rejects a missing or empty text field", () => {
  assert.equal(parseTextTransformResponse(JSON.stringify({})), null);
  assert.equal(parseTextTransformResponse(JSON.stringify({ text: "" })), null);
  assert.equal(parseTextTransformResponse(JSON.stringify({ text: "   " })), null);
  assert.equal(parseTextTransformResponse(JSON.stringify({ text: 42 })), null);
});

test("caps output length", () => {
  const long = "a".repeat(9000);
  const parsed = parseTextTransformResponse(JSON.stringify({ text: long }));
  assert.ok(parsed);
  assert.equal(parsed.text.length, 8000);
});
