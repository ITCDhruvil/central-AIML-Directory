import { test } from "node:test";
import assert from "node:assert/strict";
import { runNoteAi, buildNoteUserMessage, NoteAiError } from "@/lib/ai/noteAi";

const config = { apiKey: "k", model: "m", temperature: 0, maxOutputTokens: 100 };

test("builds the task instruction per action and includes the notes", () => {
  assert.match(buildNoteUserMessage("action-items", "call Sam"), /Markdown checklist/);
  assert.match(buildNoteUserMessage("summarize", "call Sam"), /call Sam/);
});

test("trims very long notes", () => {
  assert.match(buildNoteUserMessage("summarize", "a".repeat(20000)), /\[notes truncated\]/);
});

test("parses text, rejects malformed or empty output", async () => {
  assert.equal(await runNoteAi("summarize", "n", config, async () => '{"text":" ok "}'), "ok");
  await assert.rejects(() => runNoteAi("summarize", "n", config, async () => "x"), NoteAiError);
  await assert.rejects(() => runNoteAi("summarize", "n", config, async () => '{"text":""}'), NoteAiError);
});
