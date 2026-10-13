import { test } from "node:test";
import assert from "node:assert/strict";
import type { ChatCompletionMessage } from "@/lib/ai/chatTypes";
import {
  extractClientAction,
  extractConfirmation,
  extractFallbackAction,
  extractFollowUps,
  fixPlaceholderLinks,
  extractNavAction,
  extractRelatedLink,
  stripDuplicateLink,
} from "@/lib/ai/chatbotUi";
import { CHATBOT_SYSTEM_PROMPT } from "@/lib/ai/chatbotPrompts";

function tool(content: unknown): ChatCompletionMessage {
  return { role: "tool", tool_call_id: "c1", content: JSON.stringify(content) };
}

test("prompt covers ideas, insights, dashboard, settings, and full-schema search", () => {
  assert.match(CHATBOT_SYSTEM_PROMPT, /ideas/i);
  assert.match(CHATBOT_SYSTEM_PROMPT, /insights/i);
  assert.match(CHATBOT_SYSTEM_PROMPT, /dashboard/i);
  assert.match(CHATBOT_SYSTEM_PROMPT, /set_appearance/);
  assert.match(CHATBOT_SYSTEM_PROMPT, /applied: true/);
  assert.match(CHATBOT_SYSTEM_PROMPT, /open_page/);
  assert.match(CHATBOT_SYSTEM_PROMPT, /search_workspace/);
  assert.match(CHATBOT_SYSTEM_PROMPT, /every text field in the schema/i);
  assert.match(CHATBOT_SYSTEM_PROMPT, /documentation/);
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

test("extractFollowUps: pulls the final Next: line into chips and removes it from the text", () => {
  const r = extractFollowUps("You have 3 ideas.\n\nNext: show active ideas | add a new idea | open the dashboard");
  assert.equal(r.text, "You have 3 ideas.");
  assert.deepEqual(r.followUps, ["show active ideas", "add a new idea", "open the dashboard"]);
});

test("extractFollowUps: tolerates bold and 'Next steps', keeps at most three, drops over-long ones", () => {
  const r = extractFollowUps(`Done.\n**Next steps:** a | b | c | d | ${"x".repeat(80)}`);
  assert.deepEqual(r.followUps, ["a", "b", "c"]);
  assert.equal(r.text, "Done.");
});

test("extractFollowUps: only the last line counts, and a plain reply is untouched", () => {
  assert.deepEqual(extractFollowUps("Next: do this | do that\nThanks for asking."), { text: "Next: do this | do that\nThanks for asking.", followUps: [] });
  assert.deepEqual(extractFollowUps("Just an answer."), { text: "Just an answer.", followUps: [] });
});

test("extractFollowUps: a reply that is only suggestions is left as written", () => {
  const only = "Next: one | two";
  assert.deepEqual(extractFollowUps(only), { text: only, followUps: [] });
});

test("extractFollowUps: trailing full stops are trimmed from the chips", () => {
  assert.deepEqual(extractFollowUps("Answer.\nNext: show my projects | open the dashboard.").followUps, ["show my projects", "open the dashboard"]);
});

test("fixPlaceholderLinks: turns invented domains into in-app paths", () => {
  assert.equal(fixPlaceholderLinks("[Idea](https://your-link.com/ideas/abc123)"), "[Idea](/ideas/abc123)");
  assert.equal(fixPlaceholderLinks("[P](http://localhost:3000/projects/p1) and [Q](https://example.com/projects/q2)"), "[P](/projects/p1) and [Q](/projects/q2)");
});

test("fixPlaceholderLinks: leaves real links alone", () => {
  const real = "[repo](https://github.com/ITCDhruvil/ais-prototype) and [app](/projects/p1)";
  assert.equal(fixPlaceholderLinks(real), real);
});

test("extractFollowUps: understands a Next: header followed by bullet lines", () => {
  const r = extractFollowUps("Idea created.\n\nNext:\n- Want to add more details?\n- Promote it to a project\n- View all your ideas");
  assert.equal(r.text, "Idea created.");
  assert.deepEqual(r.followUps, ["Want to add more details?", "Promote it to a project", "View all your ideas"]);
});

test("extractFollowUps: bullets without a Next header are ordinary content", () => {
  const plain = "Here are options:\n- one\n- two";
  assert.deepEqual(extractFollowUps(plain), { text: plain, followUps: [] });
});

test("extractFollowUps: a bare Next header with nothing under it is left alone", () => {
  assert.deepEqual(extractFollowUps("Done.\nNext:"), { text: "Done.\nNext:", followUps: [] });
});

test("extractFollowUps: stray pipes at the ends of options are removed", () => {
  const r = extractFollowUps("Done.\nNext:\n- Show details for an idea |\n- Promote an idea |\n- Create a new idea");
  assert.deepEqual(r.followUps, ["Show details for an idea", "Promote an idea", "Create a new idea"]);
});
