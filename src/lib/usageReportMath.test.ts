import assert from "node:assert/strict";
import test from "node:test";
import { bucketByDay } from "@/lib/usageReportMath";

const now = new Date("2026-10-12T15:00:00Z");
const row = (iso: string, status: string, i = 0, o = 0) => ({ createdAt: new Date(iso), status, inputTokens: i, outputTokens: o });

test("one bucket per day, oldest first, with empty days kept", () => {
  const b = bucketByDay([], 3, now);
  assert.deepEqual(b.map((x) => x.date), ["2026-10-10", "2026-10-11", "2026-10-12"]);
  assert.ok(b.every((x) => x.requests === 0 && x.tokens === 0 && x.blocked === 0));
});

test("counts requests and tokens for calls that reached the model", () => {
  const b = bucketByDay([row("2026-10-12T01:00:00Z", "OK", 10, 5), row("2026-10-12T02:00:00Z", "ERROR", 3, 0)], 2, now);
  assert.equal(b[1].requests, 2);
  assert.equal(b[1].tokens, 18);
});

test("blocked attempts are counted apart and add no tokens", () => {
  const b = bucketByDay([row("2026-10-11T09:00:00Z", "BLOCKED_QUOTA"), row("2026-10-11T10:00:00Z", "BLOCKED_PERMISSION")], 2, now);
  assert.equal(b[0].blocked, 2);
  assert.equal(b[0].requests, 0);
});

test("rows outside the window are ignored", () => {
  const b = bucketByDay([row("2026-09-01T00:00:00Z", "OK", 1, 1)], 3, now);
  assert.equal(b.reduce((n, x) => n + x.requests, 0), 0);
});
