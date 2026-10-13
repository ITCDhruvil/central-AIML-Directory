import { test } from "node:test";
import assert from "node:assert/strict";
import { extractCredentials, redactMessagesForModel, redactToolContent } from "@/lib/ai/chatbotRedact";
import type { ChatCompletionMessage } from "@/lib/ai/chatTypes";

const tool = (payload: unknown): ChatCompletionMessage => ({
  role: "tool",
  tool_call_id: "t1",
  content: JSON.stringify(payload),
});

test("redactToolContent hides credentials but keeps the rest of the result", () => {
  const out = JSON.parse(
    redactToolContent(JSON.stringify({ created: true, user: { name: "Ada" }, credentials: { email: "a@b.co", password: "Secret-1!" } })),
  );
  assert.equal(out.created, true);
  assert.equal(out.user.name, "Ada");
  assert.equal(typeof out.credentials, "string");
  assert.ok(!JSON.stringify(out).includes("Secret-1!"));
});

test("redactToolContent leaves results without credentials, and non-JSON, untouched", () => {
  const plain = JSON.stringify({ count: 2 });
  assert.equal(redactToolContent(plain), plain);
  assert.equal(redactToolContent("not json"), "not json");
});

test("redactMessagesForModel only rewrites tool messages", () => {
  const messages: ChatCompletionMessage[] = [
    { role: "user", content: "create ada" },
    tool({ credentials: { email: "a@b.co", password: "Secret-1!" } }),
    { role: "assistant", content: "Done" },
  ];
  const redacted = redactMessagesForModel(messages);
  assert.equal(redacted[0], messages[0]);
  assert.ok(!JSON.stringify(redacted).includes("Secret-1!"));
  assert.ok(JSON.stringify(messages).includes("Secret-1!"), "original is not mutated");
});

test("extractCredentials reads the latest credentials from this turn's tool messages", () => {
  const messages: ChatCompletionMessage[] = [
    tool({ credentials: { email: "a@b.co", password: "Secret-1!", note: "temporary" } }),
    { role: "assistant", content: "Created" },
  ];
  assert.deepEqual(extractCredentials(messages), { email: "a@b.co", password: "Secret-1!", note: "temporary" });
  assert.equal(extractCredentials([tool({ count: 1 })]), null);
});
