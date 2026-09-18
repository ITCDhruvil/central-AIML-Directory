import { test } from "node:test";
import assert from "node:assert/strict";
import { runChatbotTurn, type ToolHandler } from "@/lib/ai/chatbot";
import type { ChatCompletionMessage, ToolCallFn } from "@/lib/ai/chatTypes";
import type { AIConfig } from "@/lib/ai/types";

const config: AIConfig = { apiKey: "test-key", model: "test-model", temperature: 0.1, maxOutputTokens: 800 };

function userTurn(content: string): ChatCompletionMessage[] {
  return [{ role: "user", content }];
}

test("returns the assistant's plain-text reply when it makes no tool calls", async () => {
  const callWithTools: ToolCallFn = async () => ({ role: "assistant", content: "Hi there!" });
  const result = await runChatbotTurn(userTurn("hello"), config, callWithTools, [], {});
  assert.deepEqual(result, [{ role: "assistant", content: "Hi there!" }]);
});

test("executes a tool call, feeds the result back, and returns the final reply", async () => {
  let call = 0;
  const callWithTools: ToolCallFn = async () => {
    call += 1;
    if (call === 1) {
      return {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "call_1", type: "function", function: { name: "ping", arguments: "{}" } }],
      };
    }
    return { role: "assistant", content: "Done." };
  };
  const handlers: Record<string, ToolHandler> = { ping: async () => ({ pong: true }) };

  const result = await runChatbotTurn(userTurn("ping it"), config, callWithTools, [], handlers);

  assert.equal(result.length, 3);
  assert.equal(result[0].role, "assistant");
  assert.equal(result[1].role, "tool");
  assert.equal(result[1].tool_call_id, "call_1");
  assert.equal(result[1].content, JSON.stringify({ pong: true }));
  assert.deepEqual(result[2], { role: "assistant", content: "Done." });
});

test("executes multiple tool calls from one assistant turn, in order", async () => {
  let call = 0;
  const callWithTools: ToolCallFn = async () => {
    call += 1;
    if (call === 1) {
      return {
        role: "assistant",
        content: null,
        tool_calls: [
          { id: "a", type: "function", function: { name: "one", arguments: "{}" } },
          { id: "b", type: "function", function: { name: "two", arguments: "{}" } },
        ],
      };
    }
    return { role: "assistant", content: "ok" };
  };
  const handlers: Record<string, ToolHandler> = {
    one: async () => "first",
    two: async () => "second",
  };

  const result = await runChatbotTurn(userTurn("go"), config, callWithTools, [], handlers);

  assert.equal(result[1].tool_call_id, "a");
  assert.equal(result[1].content, JSON.stringify("first"));
  assert.equal(result[2].tool_call_id, "b");
  assert.equal(result[2].content, JSON.stringify("second"));
});

test("reports an unknown tool name instead of throwing", async () => {
  let call = 0;
  const callWithTools: ToolCallFn = async () => {
    call += 1;
    if (call === 1) {
      return {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "x", type: "function", function: { name: "does_not_exist", arguments: "{}" } }],
      };
    }
    return { role: "assistant", content: "handled" };
  };

  const result = await runChatbotTurn(userTurn("go"), config, callWithTools, [], {});
  const toolMessage = result.find((m) => m.role === "tool");
  assert.ok(toolMessage);
  assert.match(toolMessage.content ?? "", /Unknown tool/);
});

test("wraps a thrown tool error instead of crashing the turn", async () => {
  let call = 0;
  const callWithTools: ToolCallFn = async () => {
    call += 1;
    if (call === 1) {
      return {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "x", type: "function", function: { name: "boom", arguments: "{}" } }],
      };
    }
    return { role: "assistant", content: "recovered" };
  };
  const handlers: Record<string, ToolHandler> = {
    boom: async () => {
      throw new Error("db is down");
    },
  };

  const result = await runChatbotTurn(userTurn("go"), config, callWithTools, [], handlers);
  const toolMessage = result.find((m) => m.role === "tool");
  assert.equal(toolMessage?.content, JSON.stringify({ error: "db is down" }));
});

test("treats invalid tool-call arguments JSON as an empty-args error, not a crash", async () => {
  let call = 0;
  const callWithTools: ToolCallFn = async () => {
    call += 1;
    if (call === 1) {
      return {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "x", type: "function", function: { name: "echo", arguments: "not json" } }],
      };
    }
    return { role: "assistant", content: "ok" };
  };
  const handlers: Record<string, ToolHandler> = { echo: async () => "should not run" };

  const result = await runChatbotTurn(userTurn("go"), config, callWithTools, [], handlers);
  const toolMessage = result.find((m) => m.role === "tool");
  assert.match(toolMessage?.content ?? "", /not valid JSON/);
});

test("stops after the iteration cap instead of looping forever", async () => {
  let calls = 0;
  const callWithTools: ToolCallFn = async () => {
    calls += 1;
    return {
      role: "assistant",
      content: null,
      tool_calls: [{ id: `c${calls}`, type: "function", function: { name: "loop", arguments: "{}" } }],
    };
  };
  const handlers: Record<string, ToolHandler> = { loop: async () => "again" };

  const result = await runChatbotTurn(userTurn("go"), config, callWithTools, [], handlers);

  assert.equal(calls, 6);
  const last = result[result.length - 1];
  assert.equal(last.role, "assistant");
  assert.match(last.content ?? "", /taking more steps/);
});
