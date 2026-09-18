import { test } from "node:test";
import assert from "node:assert/strict";
import { transformText, TextTransformResponseError } from "@/lib/ai/textTransform";
import { buildTextTransformUserMessage, TEXT_TRANSFORM_SYSTEM_PROMPT } from "@/lib/ai/textTransformPrompts";
import type { AIConfig, GenerateFn } from "@/lib/ai/types";

const config: AIConfig = { apiKey: "test-key", model: "test-model", temperature: 0.1, maxOutputTokens: 800 };

test("returns the rewritten text on a well-formed response", async () => {
  const generate: GenerateFn = async () => JSON.stringify({ text: "Rewritten." });
  const result = await transformText({ action: "improve", text: "Original." }, config, generate);
  assert.equal(result, "Rewritten.");
});

test("throws TextTransformResponseError on a malformed response instead of forwarding it", async () => {
  const generate: GenerateFn = async () => "not json";
  await assert.rejects(() => transformText({ action: "shorten", text: "x" }, config, generate), TextTransformResponseError);
});

test("passes the tone through to the user message for the tone action", async () => {
  let captured = "";
  const generate: GenerateFn = async (_system, userMessage) => {
    captured = userMessage;
    return JSON.stringify({ text: "ok" });
  };
  await transformText({ action: "tone", tone: "confident", text: "Some text." }, config, generate);
  assert.match(captured, /Tone: confident/);
});

test("passes the language through to the user message for the translate action", async () => {
  let captured = "";
  const generate: GenerateFn = async (_system, userMessage) => {
    captured = userMessage;
    return JSON.stringify({ text: "ok" });
  };
  await transformText({ action: "translate", language: "German", text: "Some text." }, config, generate);
  assert.match(captured, /Language: German/);
});

test("system prompt frames the supplied text as data, not instructions, and forbids inventing facts", () => {
  assert.match(TEXT_TRANSFORM_SYSTEM_PROMPT, /DATA to rewrite/i);
  assert.match(TEXT_TRANSFORM_SYSTEM_PROMPT, /never add new facts/i);
});

test("buildTextTransformUserMessage includes the action instruction and the text", () => {
  const message = buildTextTransformUserMessage({ action: "fix-grammar", text: "teh quick fox" });
  assert.match(message, /spelling and grammar/i);
  assert.match(message, /teh quick fox/);
});
