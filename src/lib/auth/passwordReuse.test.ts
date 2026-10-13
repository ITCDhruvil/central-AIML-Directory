import assert from "node:assert/strict";
import test from "node:test";
import { matchesAnyHash, PASSWORD_HISTORY_LIMIT } from "@/lib/auth/passwordReuse";

// Fake "hash": reversible, so the test needs no bcrypt.
const hash = (p: string) => `h:${p}`;
const verify = async (p: string, h: string) => hash(p) === h;

test("matchesAnyHash: finds a previous password", async () => {
  assert.equal(await matchesAnyHash("old-one", [hash("older"), hash("old-one")], verify), true);
});

test("matchesAnyHash: a new password is not a match", async () => {
  assert.equal(await matchesAnyHash("brand-new", [hash("a"), hash("b")], verify), false);
});

test("matchesAnyHash: empty history never matches", async () => {
  assert.equal(await matchesAnyHash("anything", [], verify), false);
});

test("history limit is a sensible positive number", () => {
  assert.ok(PASSWORD_HISTORY_LIMIT >= 1);
});
