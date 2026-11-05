import { test } from "node:test";
import assert from "node:assert/strict";
import { askDocument, buildDocUserMessage, DocAssistantError } from "@/lib/ai/docAssistant";

const config = { apiKey: "k", model: "m", temperature: 0, maxOutputTokens: 100 };

test("builds a summary task when no question is given, a question task otherwise", () => {
  assert.match(buildDocUserMessage({ title: "T", category: "PRD", content: "x", question: null }), /Task: Write a short summary/);
  assert.match(buildDocUserMessage({ title: "T", category: "PRD", content: "x", question: "What is it?" }), /Question: What is it\?/);
});

test("trims a very long document", () => {
  const msg = buildDocUserMessage({ title: "T", category: "PRD", content: "a".repeat(20000), question: null });
  assert.match(msg, /\[document truncated\]/);
});

test("parses the answer, and rejects malformed or empty output", async () => {
  assert.equal(await askDocument({ title: "T", category: "PRD", content: "c", question: null }, config, async () => '{"answer":"  Hi  "}'), "Hi");
  await assert.rejects(() => askDocument({ title: "T", category: "PRD", content: "c", question: null }, config, async () => "not json"), DocAssistantError);
  await assert.rejects(() => askDocument({ title: "T", category: "PRD", content: "c", question: null }, config, async () => '{"answer":""}'), DocAssistantError);
});
