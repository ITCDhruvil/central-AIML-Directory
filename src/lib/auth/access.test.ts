import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizeUser, isPublicPath, safeRedirectTarget } from "@/lib/auth/access";
import { createRateLimiter } from "@/lib/auth/rateLimit";
import { DEFAULT_ROLE_MATRIX, resolvePermissions } from "@/lib/auth/permissions";

const member = {
  id: "u1",
  role: "MEMBER" as const,
  permissions: resolvePermissions("MEMBER", DEFAULT_ROLE_MATRIX.MEMBER, []),
};

test("public paths: login and auth endpoints only", () => {
  assert.equal(isPublicPath("/login"), true);
  assert.equal(isPublicPath("/api/auth/login"), true);
  assert.equal(isPublicPath("/"), false);
  assert.equal(isPublicPath("/projects"), false);
  assert.equal(isPublicPath("/api/projects"), false);
  assert.equal(isPublicPath("/login/../projects"), false);
  assert.equal(isPublicPath("/loginx"), false);
});

test("forgot-password page and endpoint are public", () => {
  assert.equal(isPublicPath("/forgot-password"), true);
  assert.equal(isPublicPath("/api/auth/forgot"), true);
  assert.equal(isPublicPath("/api/admin/reset-requests"), false);
});

test("authorizeUser: no user is 401", () => {
  const result = authorizeUser(null, "projects", "view");
  assert.deepEqual(result, { ok: false, status: 401, error: "Authentication required" });
});

test("authorizeUser: missing permission is 403", () => {
  const result = authorizeUser(member, "projects", "delete");
  assert.deepEqual(result, { ok: false, status: 403, error: "Forbidden" });
});

test("authorizeUser: allowed returns scope", () => {
  const result = authorizeUser(member, "projects", "view");
  assert.deepEqual(result, { ok: true, scope: "OWN" });
});

test("safeRedirectTarget only allows same-site relative paths", () => {
  assert.equal(safeRedirectTarget("/projects?x=1"), "/projects?x=1");
  assert.equal(safeRedirectTarget("//evil.com"), "/");
  assert.equal(safeRedirectTarget("https://evil.com"), "/");
  assert.equal(safeRedirectTarget("/\\evil.com"), "/");
  assert.equal(safeRedirectTarget("/login"), "/");
  assert.equal(safeRedirectTarget(null), "/");
});

test("rate limiter blocks after max attempts and recovers after the window", () => {
  let now = 1000;
  const limiter = createRateLimiter({ max: 3, windowMs: 60_000, now: () => now });
  assert.equal(limiter.check("k").allowed, true);
  assert.equal(limiter.check("k").allowed, true);
  assert.equal(limiter.check("k").allowed, true);
  const blocked = limiter.check("k");
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);
  assert.equal(limiter.check("other").allowed, true);
  now += 61_000;
  assert.equal(limiter.check("k").allowed, true);
});

test("rate limiter reset clears a key", () => {
  const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
  limiter.check("k");
  assert.equal(limiter.check("k").allowed, false);
  limiter.reset("k");
  assert.equal(limiter.check("k").allowed, true);
});

test("rate limiter peek does not count; only check does", () => {
  const limiter = createRateLimiter({ max: 2, windowMs: 60_000 });
  for (let i = 0; i < 10; i++) assert.equal(limiter.peek("k").allowed, true);
  limiter.check("k");
  limiter.check("k");
  assert.equal(limiter.peek("k").allowed, false);
});
