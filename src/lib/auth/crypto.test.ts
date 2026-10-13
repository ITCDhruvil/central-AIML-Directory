import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, validatePasswordStrength } from "@/lib/auth/password";
import { signSessionToken, verifySessionToken } from "@/lib/auth/sessionToken";

const SECRET = "test-secret-test-secret-test-secret-123";

test("password hash verifies and rejects wrong password", async () => {
  const hash = await hashPassword("Correct-Horse-9");
  assert.notEqual(hash, "Correct-Horse-9");
  assert.equal(await verifyPassword("Correct-Horse-9", hash), true);
  assert.equal(await verifyPassword("wrong", hash), false);
});

test("verifyPassword is false for a missing hash", async () => {
  assert.equal(await verifyPassword("x", null), false);
});

test("password strength: min length 8 with a letter and a digit", () => {
  assert.equal(validatePasswordStrength("short1"), "Password must be at least 8 characters.");
  assert.equal(validatePasswordStrength("alllettersss"), "Password must include a letter and a number.");
  assert.equal(validatePasswordStrength("12345678"), "Password must include a letter and a number.");
  assert.equal(validatePasswordStrength("goodpass1"), null);
});

test("session token round-trips uid and session version", async () => {
  const token = await signSessionToken({ uid: "u1", sv: 3 }, SECRET);
  const payload = await verifySessionToken(token, SECRET);
  assert.deepEqual(payload, { uid: "u1", sv: 3 });
});

test("session token rejects tampering and wrong secret", async () => {
  const token = await signSessionToken({ uid: "u1", sv: 1 }, SECRET);
  assert.equal(await verifySessionToken(token + "x", SECRET), null);
  assert.equal(await verifySessionToken(token, "another-secret-another-secret-12345"), null);
  assert.equal(await verifySessionToken("garbage", SECRET), null);
});

test("session token rejects expired tokens", async () => {
  const token = await signSessionToken({ uid: "u1", sv: 1 }, SECRET, -10);
  assert.equal(await verifySessionToken(token, SECRET), null);
});
