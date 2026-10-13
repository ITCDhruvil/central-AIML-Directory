import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_AUTO_ISSUE_MINUTES, autoIssueAt, autoIssueDue } from "@/lib/resetTiming";

const t0 = new Date("2026-10-12T10:00:00Z");

test("default window is ten minutes", () => {
  assert.equal(DEFAULT_AUTO_ISSUE_MINUTES, 10);
  assert.equal(autoIssueAt(t0, 10)?.toISOString(), "2026-10-12T10:10:00.000Z");
});

test("the wait follows the configured minutes", () => {
  assert.equal(autoIssueAt(t0, 30)?.toISOString(), "2026-10-12T10:30:00.000Z");
  assert.equal(autoIssueDue(t0, 30, new Date("2026-10-12T10:29:59Z")), false);
  assert.equal(autoIssueDue(t0, 30, new Date("2026-10-12T10:30:00Z")), true);
});

test("not due before the window, due at and after it", () => {
  assert.equal(autoIssueDue(t0, 10, new Date("2026-10-12T10:09:59Z")), false);
  assert.equal(autoIssueDue(t0, 10, new Date("2026-10-12T10:10:00Z")), true);
  assert.equal(autoIssueDue(t0, 10, new Date("2026-10-12T11:00:00Z")), true);
});

test("zero minutes turns automatic issuing off", () => {
  assert.equal(autoIssueAt(t0, 0), null);
  assert.equal(autoIssueDue(t0, 0, new Date("2030-01-01T00:00:00Z")), false);
});
