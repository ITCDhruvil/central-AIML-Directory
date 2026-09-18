import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ASSISTANT_QUESTION_LENGTH, ValidationError, validateAssistantQuestion } from "@/lib/validation";

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
