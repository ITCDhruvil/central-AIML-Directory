import { test } from "node:test";
import assert from "node:assert/strict";
import { generateInsights, InsightsResponseError } from "@/lib/ai/insights";
import type { ChatCompletionMessage, ToolCallFn } from "@/lib/ai/chatTypes";
import type { ToolHandler } from "@/lib/ai/toolLoop";
import type { AIConfig } from "@/lib/ai/types";

const config: AIConfig = { apiKey: "test-key", model: "test-model", temperature: 0.1, maxOutputTokens: 800 };

const SUGGESTION = { type: "new_idea", title: "Title", reasoning: "Because.", suggestedTool: "Tool", relatedProjectName: null, sourceUrls: [] };

test("returns parsed suggestions when the model answers without calling a tool", async () => {
  const callWithTools: ToolCallFn = async () => ({ role: "assistant", content: JSON.stringify([SUGGESTION]) });
  const result = await generateInsights("context", config, callWithTools, [], {});
  assert.deepEqual(result, [SUGGESTION]);
});

test("executes a web_search tool call before producing the final answer", async () => {
  let call = 0;
  const seenQueries: string[] = [];
  const callWithTools: ToolCallFn = async (messages: ChatCompletionMessage[]) => {
    call += 1;
    if (call === 1) {
      return {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "c1", type: "function", function: { name: "web_search", arguments: JSON.stringify({ query: "vector db 2026" }) } }],
      };
    }
    const toolMsg = messages.find((m) => m.role === "tool");
    if (toolMsg?.content) seenQueries.push(toolMsg.content);
    return { role: "assistant", content: JSON.stringify([SUGGESTION]) };
  };
  const handlers: Record<string, ToolHandler> = {
    web_search: async (args) => ({ results: [{ title: "x", url: "https://x.com", snippet: args.query }] }),
  };

  const result = await generateInsights("context", config, callWithTools, [], handlers);
  assert.deepEqual(result, [SUGGESTION]);
  assert.match(seenQueries[0], /vector db 2026/);
});

test("throws InsightsResponseError on a final answer that isn't valid JSON", async () => {
  const callWithTools: ToolCallFn = async () => ({ role: "assistant", content: "not json" });
  await assert.rejects(() => generateInsights("context", config, callWithTools, [], {}), InsightsResponseError);
});

test("throws InsightsResponseError after exhausting the iteration cap", async () => {
  const callWithTools: ToolCallFn = async () => ({
    role: "assistant",
    content: null,
    tool_calls: [{ id: "loop", type: "function", function: { name: "web_search", arguments: "{}" } }],
  });
  const handlers: Record<string, ToolHandler> = { web_search: async () => ({ results: [] }) };
  await assert.rejects(() => generateInsights("context", config, callWithTools, [], handlers), InsightsResponseError);
});
