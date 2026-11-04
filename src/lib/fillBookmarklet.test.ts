import { test } from "node:test";
import assert from "node:assert/strict";
import { FILL_BOOKMARKLET, FILL_PREFIX, fillPayload } from "@/lib/fillBookmarklet";

test("the bookmark is one line of valid JavaScript with no credentials in it", () => {
  assert.ok(FILL_BOOKMARKLET.startsWith("javascript:"));
  assert.ok(!/[\r\n]/.test(FILL_BOOKMARKLET));
  // Parses (the async function is only created, not run).
  assert.doesNotThrow(() => new Function(FILL_BOOKMARKLET.slice("javascript:".length)));
  assert.ok(!FILL_BOOKMARKLET.includes("@"));
});

test("the payload carries the username and password under the marker", () => {
  const payload = fillPayload("space@example.test", 'pa"ss\\word');
  assert.ok(payload.startsWith(FILL_PREFIX));
  assert.deepEqual(JSON.parse(payload.slice(FILL_PREFIX.length)), { u: "space@example.test", p: 'pa"ss\\word' });
});
