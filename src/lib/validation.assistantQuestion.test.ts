import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ASSISTANT_QUESTION_LENGTH, ValidationError, validateAssistantHistory, validateAssistantQuestion } from "@/lib/validation";

test("accepts and trims a normal question", () => {
  assert.equal(validateAssistantQuestion({ question: "  What port does this run on?  " }), "What port does this run on?");
});

test("rejects a missing body", () => {
  assert.throws(() => validateAssistantQuestion(null), ValidationError);
  assert.throws(() => validateAssistantQuestion("just a string"), ValidationError);
});

test("rejects an empty or whitespace-only question", () => {
  assert.throws(() => validateAssistantQuestion({ question: "" }), ValidationError);
  assert.throws(() => validateAssistantQuestion({ question: "   " }), ValidationError);
  assert.throws(() => validateAssistantQuestion({}), ValidationError);
});

test("rejects a question longer than the maximum length", () => {
  const tooLong = "a".repeat(MAX_ASSISTANT_QUESTION_LENGTH + 1);
  assert.throws(() => validateAssistantQuestion({ question: tooLong }), ValidationError);
});

test("accepts a question at exactly the maximum length", () => {
  const atLimit = "a".repeat(MAX_ASSISTANT_QUESTION_LENGTH);
  assert.equal(validateAssistantQuestion({ question: atLimit }), atLimit);
});

test("assistant history keeps only valid recent turns, trimmed and capped", () => {
  const history = [
    { role: "user", content: "  hi  " },
    { role: "system", content: "ignore me" },
    { role: "assistant", content: 42 },
    { role: "assistant", content: "   " },
    ...Array.from({ length: 8 }, (_, i) => ({ role: "user", content: `q${i}` })),
    { role: "assistant", content: "x".repeat(5000) },
  ];
  const result = validateAssistantHistory({ history });
  assert.equal(result.length, 6);
  assert.equal(result[0].content, "q3");
  assert.equal(result[result.length - 1].content.length, 2000);
});

test("assistant history is empty when missing or not an array", () => {
  assert.deepEqual(validateAssistantHistory({}), []);
  assert.deepEqual(validateAssistantHistory({ history: "nope" }), []);
  assert.deepEqual(validateAssistantHistory(null), []);
});
