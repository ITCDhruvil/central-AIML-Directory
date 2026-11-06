import { test } from "node:test";
import assert from "node:assert/strict";
import { buildComposeMessage, compose, ComposeError } from "@/lib/ai/compose";

const config = { apiKey: "k", model: "m", temperature: 0, maxOutputTokens: 100 };

test("builds the right message per action", () => {
  assert.match(buildComposeMessage({ action: "write", prompt: "a plan" }), /Write content for this request:\na plan/);
  assert.match(buildComposeMessage({ action: "continue", text: "half a sentence" }), /Continue this text/);
  assert.match(buildComposeMessage({ action: "complete", text: "half" }), /at most 15 words/);
  assert.match(buildComposeMessage({ action: "custom", prompt: "make it formal", text: "hey" }), /Instruction: make it formal/);
});

test("parses the text, rejects malformed or empty output", async () => {
  assert.equal(await compose({ action: "write", prompt: "x" }, config, async () => '{"text":" ok "}'), "ok");
  await assert.rejects(() => compose({ action: "write", prompt: "x" }, config, async () => "nope"), ComposeError);
  await assert.rejects(() => compose({ action: "write", prompt: "x" }, config, async () => '{"text":""}'), ComposeError);
});
