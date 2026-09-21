import { test } from "node:test";
import assert from "node:assert/strict";
import type { ChatCompletionMessage } from "@/lib/ai/chatTypes";
import {
  extractClientAction,
  extractConfirmation,
  extractFallbackAction,
  extractNavAction,
  extractRelatedLink,
  stripDuplicateLink,
} from "@/lib/ai/chatbotUi";
import { CHATBOT_SYSTEM_PROMPT } from "@/lib/ai/chatbotPrompts";

function tool(content: unknown): ChatCompletionMessage {
  return { role: "tool", tool_call_id: "c1", content: JSON.stringify(content) };
}

test("prompt covers ideas, insights, dashboard, and settings", () => {
  assert.match(CHATBOT_SYSTEM_PROMPT, /ideas/i);
  assert.match(CHATBOT_SYSTEM_PROMPT, /insights/i);
  assert.match(CHATBOT_SYSTEM_PROMPT, /dashboard/i);
  assert.match(CHATBOT_SYSTEM_PROMPT, /set_appearance/);
  assert.match(CHATBOT_SYSTEM_PROMPT, /applied: true/);
  assert.match(CHATBOT_SYSTEM_PROMPT, /open_page/);
  assert.doesNotMatch(CHATBOT_SYSTEM_PROMPT, /You manage projects: list\/search/);
});

test("extractRelatedLink prefers the newest project or idea from tool results", () => {
  const messages: ChatCompletionMessage[] = [
    tool({ idea: { id: "i1", name: "Old idea" } }),
    { role: "assistant", content: null },
    tool({ project: { id: "p1", name: "Spark Compose" } }),
  ];
  assert.deepEqual(extractRelatedLink(messages), { href: "/projects/p1", label: "Spark Compose" });
});

test("extractRelatedLink uses idea when no project is present", () => {
  const messages: ChatCompletionMessage[] = [tool({ idea: { id: "i1", name: "Talk to Your Data" } })];
  assert.deepEqual(extractRelatedLink(messages), { href: "/ideas/i1", label: "Talk to Your Data" });
});

test("extractConfirmation distinguishes delete vs promote", () => {
  assert.deepEqual(
    extractConfirmation([tool({ requiresConfirmation: true, idea: { id: "i1", name: "Alpha" } })]),
    { yesText: "Yes, delete Alpha.", noText: "No, cancel that." },
  );
  assert.deepEqual(
    extractConfirmation([
      tool({ requiresConfirmation: true, action: "promote", idea: { id: "i1", name: "Alpha" } }),
    ]),
    { yesText: "Yes, promote Alpha to a project.", noText: "No, cancel that." },
  );
});

test("extractFallbackAction and extractNavAction only read the last tool result", () => {
  const messages: ChatCompletionMessage[] = [
    tool({ fallbackAction: { href: "/stale", label: "Stale" } }),
    tool({ navAction: { href: "/insights", label: "Open insights" } }),
  ];
  assert.equal(extractFallbackAction(messages), null);
  assert.deepEqual(extractNavAction(messages), { href: "/insights", label: "Open insights" });
});

test("extractClientAction reads set_theme from the last tool result", () => {
  const messages: ChatCompletionMessage[] = [
    tool({ clientAction: { type: "set_theme", theme: "dark" } }),
  ];
  assert.deepEqual(extractClientAction(messages), { type: "set_theme", theme: "dark" });
});

test("extractClientAction finds set_theme even when a later tool in the same turn has no clientAction", () => {
  const messages: ChatCompletionMessage[] = [
    tool({ applied: true, clientAction: { type: "set_theme", theme: "light" } }),
    tool({ opened: true, navAction: { href: "/settings", label: "Open settings" } }),
  ];
  assert.deepEqual(extractClientAction(messages), { type: "set_theme", theme: "light" });
});

test("stripDuplicateLink removes a markdown link to the button href", () => {
  const out = stripDuplicateLink("Open [Settings](/settings) next.", "/settings");
  assert.equal(out, "Open Settings next.");
});
