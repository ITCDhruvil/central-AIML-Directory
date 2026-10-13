import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SECURITY_POLICY,
  parsePolicy,
  rememberSeconds,
  sanitizePolicy,
  sessionSeconds,
} from "@/lib/securityPolicy";

test("defaults match the behaviour the app had before policy settings", () => {
  assert.equal(DEFAULT_SECURITY_POLICY.passwordMinLength, 8);
  assert.equal(DEFAULT_SECURITY_POLICY.passwordHistoryCount, 5);
  assert.equal(DEFAULT_SECURITY_POLICY.resetAutoIssueMinutes, 10);
  assert.equal(DEFAULT_SECURITY_POLICY.sessionHours, 12);
  assert.equal(DEFAULT_SECURITY_POLICY.rememberDays, 7);
  assert.equal(DEFAULT_SECURITY_POLICY.loginMaxFailures, 8);
  assert.equal(DEFAULT_SECURITY_POLICY.loginWindowMinutes, 15);
});

test("sanitizePolicy: partial input fills in defaults", () => {
  const r = sanitizePolicy({ passwordMinLength: 12 });
  assert.ok(r.ok);
  assert.equal(r.policy.passwordMinLength, 12);
  assert.equal(r.policy.rememberDays, 7);
});

test("sanitizePolicy: refuses a policy weaker than the floor", () => {
  assert.equal(sanitizePolicy({ passwordMinLength: 4 }).ok, false);
  assert.equal(sanitizePolicy({ loginMaxFailures: 1 }).ok, false);
});

test("sanitizePolicy: refuses out-of-range, fractional and non-numeric values", () => {
  assert.equal(sanitizePolicy({ sessionHours: 500 }).ok, false);
  assert.equal(sanitizePolicy({ rememberDays: 1.5 }).ok, false);
  assert.equal(sanitizePolicy({ passwordHistoryCount: "5" }).ok, false);
  assert.equal(sanitizePolicy({ requireSymbol: "yes" }).ok, false);
  assert.equal(sanitizePolicy(null).ok, false);
});

test("sanitizePolicy: zero is allowed where it means 'off'", () => {
  const r = sanitizePolicy({ resetAutoIssueMinutes: 0, passwordHistoryCount: 0 });
  assert.ok(r.ok);
  assert.equal(r.policy.resetAutoIssueMinutes, 0);
  assert.equal(r.policy.passwordHistoryCount, 0);
});

test("parsePolicy: missing or broken storage gives the defaults", () => {
  assert.deepEqual(parsePolicy(null), DEFAULT_SECURITY_POLICY);
  assert.deepEqual(parsePolicy("not json"), DEFAULT_SECURITY_POLICY);
});

test("parsePolicy: keeps valid fields and drops invalid ones individually", () => {
  const p = parsePolicy(JSON.stringify({ passwordMinLength: 14, sessionHours: 9999, requireSymbol: true }));
  assert.equal(p.passwordMinLength, 14);
  assert.equal(p.sessionHours, DEFAULT_SECURITY_POLICY.sessionHours);
  assert.equal(p.requireSymbol, true);
});

test("duration helpers convert to seconds", () => {
  assert.equal(sessionSeconds({ ...DEFAULT_SECURITY_POLICY, sessionHours: 2 }), 7200);
  assert.equal(rememberSeconds({ ...DEFAULT_SECURITY_POLICY, rememberDays: 1 }), 86400);
});
