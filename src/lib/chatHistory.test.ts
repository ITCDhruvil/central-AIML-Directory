import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_CONVERSATIONS,
  cutBeforeUserTurn,
  parseConversations,
  pinnedAndRecent,
  removeConversation,
  sortConversations,
  titleFromPrompt,
  togglePinned,
  upsertConversation,
  type ChatConversation,
} from "@/lib/chatHistory";

function conv(partial: Partial<ChatConversation> & Pick<ChatConversation, "id">): ChatConversation {
  return {
    title: partial.title ?? partial.id,
    pinned: partial.pinned ?? false,
    updatedAt: partial.updatedAt ?? 1,
    messages: partial.messages ?? [],
    bubbles: partial.bubbles ?? [],
    ...partial,
  };
}

test("titleFromPrompt trims, collapses space, and falls back", () => {
  assert.equal(titleFromPrompt("   What's on the dashboard?  "), "What's on the dashboard?");
  assert.equal(titleFromPrompt(" \n "), "New chat");
  const long = "a".repeat(80);
  assert.equal(titleFromPrompt(long), `${"a".repeat(69)}…`);
});

test("sortConversations keeps pinned first then newest", () => {
  const items = [
    conv({ id: "a", pinned: false, updatedAt: 3 }),
    conv({ id: "b", pinned: true, updatedAt: 1 }),
    conv({ id: "c", pinned: false, updatedAt: 2 }),
  ];
  assert.deepEqual(
    sortConversations(items).map((item) => item.id),
    ["b", "a", "c"],
  );
});

test("togglePinned and removeConversation", () => {
  const items = [conv({ id: "a" }), conv({ id: "b", pinned: true })];
  assert.equal(togglePinned(items, "a")[0].id, "a");
  assert.equal(togglePinned(items, "a").find((item) => item.id === "a")?.pinned, true);
  assert.deepEqual(
    removeConversation(items, "b").map((item) => item.id),
    ["a"],
  );
});

test("upsertConversation replaces in place and caps unpinned chats", () => {
  const many = Array.from({ length: MAX_CONVERSATIONS }, (_, i) => conv({ id: `n${i}`, updatedAt: i }));
  const next = upsertConversation(many, conv({ id: "fresh", updatedAt: 999 }));
  assert.equal(next[0].id, "fresh");
  assert.equal(next.length, MAX_CONVERSATIONS);
  assert.equal(next.some((item) => item.id === "n0"), false);
});

test("parseConversations ignores corrupt payloads", () => {
  assert.deepEqual(parseConversations(null), []);
  assert.deepEqual(parseConversations("{"), []);
  assert.deepEqual(parseConversations('[{"id":1}]'), []);
  const ok = parseConversations(
    JSON.stringify([conv({ id: "ok", title: "Hello", bubbles: [{ role: "user", content: "Hi" }] })]),
  );
  assert.equal(ok.length, 1);
  assert.equal(ok[0].id, "ok");
});

test("cutBeforeUserTurn keeps everything before the chosen user message", () => {
  const messages = [
    { role: "user" as const, content: "one" },
    { role: "assistant" as const, content: "a1" },
    { role: "user" as const, content: "two" },
    { role: "assistant" as const, content: "a2" },
  ];
  assert.deepEqual(cutBeforeUserTurn(messages, 0), []);
  assert.deepEqual(cutBeforeUserTurn(messages, 1), messages.slice(0, 2));
});

test("pinnedAndRecent splits sections", () => {
  const { pinned, recent } = pinnedAndRecent([conv({ id: "a", pinned: true }), conv({ id: "b" })]);
  assert.deepEqual(
    pinned.map((item) => item.id),
    ["a"],
  );
  assert.deepEqual(
    recent.map((item) => item.id),
    ["b"],
  );
});
