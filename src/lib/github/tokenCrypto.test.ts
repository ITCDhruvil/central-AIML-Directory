import { test } from "node:test";
import assert from "node:assert/strict";
import { decryptToken, encryptToken } from "@/lib/github/tokenCrypto";

const SECRET = "test-secret-test-secret-test-secret-123";

test("token round-trips and is not stored in plain text", () => {
  const stored = encryptToken("gho_abc123", SECRET);
  assert.ok(!stored.includes("gho_abc123"));
  assert.equal(decryptToken(stored, SECRET), "gho_abc123");
});

test("decrypt returns null for a wrong secret, tampering, or garbage", () => {
  const stored = encryptToken("gho_abc123", SECRET);
  assert.equal(decryptToken(stored, "another-secret-another-secret-12345"), null);
  assert.equal(decryptToken(stored.slice(0, -2) + "xx", SECRET), null);
  assert.equal(decryptToken("garbage", SECRET), null);
});
