import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_CHAT_MESSAGES, MAX_CHAT_MESSAGE_LENGTH, ValidationError, validateChatMessages } from "@/lib/validation";

test("accepts a normal user message", () => {
  const result = validateChatMessages({ messages: [{ role: "user", content: "list my projects" }] });
  assert.deepEqual(result, [{ role: "user", content: "list my projects" }]);
});

test("round-trips assistant tool_calls and tool results", () => {
  const messages = [
    { role: "user", content: "archive the tempclean project" },
    {
      role: "assistant",
      content: null,
      tool_calls: [{ id: "c1", type: "function", function: { name: "list_projects", arguments: "{}" } }],
    },
    { role: "tool", tool_call_id: "c1", content: "{\"count\":1}" },
    { role: "assistant", content: "Found it — want me to archive it?" },
  ];
  const result = validateChatMessages({ messages });
  assert.equal(result.length, 4);
  assert.deepEqual(result[1].tool_calls, messages[1].tool_calls);
  assert.equal(result[2].tool_call_id, "c1");
});

test("rejects a missing or non-array messages field", () => {
  assert.throws(() => validateChatMessages({}), ValidationError);
  assert.throws(() => validateChatMessages({ messages: "not an array" }), ValidationError);
  assert.throws(() => validateChatMessages({ messages: [] }), ValidationError);
  assert.throws(() => validateChatMessages(null), ValidationError);
});

test("rejects too many messages", () => {
  const messages = Array.from({ length: MAX_CHAT_MESSAGES + 1 }, () => ({ role: "user", content: "hi" }));
  assert.throws(() => validateChatMessages({ messages }), ValidationError);
});

test("rejects an invalid role", () => {
  assert.throws(() => validateChatMessages({ messages: [{ role: "system", content: "sneaky" }] }), ValidationError);
});

test("rejects a tool message without tool_call_id", () => {
  assert.throws(() => validateChatMessages({ messages: [{ role: "tool", content: "{}" }] }), ValidationError);
});

test("rejects content over the max length", () => {
  const tooLong = "a".repeat(MAX_CHAT_MESSAGE_LENGTH + 1);
  assert.throws(() => validateChatMessages({ messages: [{ role: "user", content: tooLong }] }), ValidationError);
});

test("allows null content (assistant tool-call messages have no text)", () => {
  const result = validateChatMessages({
    messages: [{ role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "x", arguments: "{}" } }] }],
  });
  assert.equal(result[0].content, null);
});
