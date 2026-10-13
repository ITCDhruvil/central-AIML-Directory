import assert from "node:assert/strict";
import test from "node:test";
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, actionLabel, actionsIn, describeMeta, sanitizeMeta } from "@/lib/auditCatalog";

test("every action belongs to a listed category and has a label", () => {
  for (const [action, info] of Object.entries(AUDIT_ACTIONS)) {
    assert.ok(AUDIT_CATEGORIES.includes(info.category), action);
    assert.ok(info.label.length > 0, action);
  }
});

test("actionLabel falls back to the raw action for unknown ones", () => {
  assert.equal(actionLabel("auth.login"), "Signed in");
  assert.equal(actionLabel("something.new"), "something.new");
});

test("actionsIn lists a category's actions", () => {
  assert.ok(actionsIn("Projects").includes("project.created"));
  assert.ok(!actionsIn("Projects").includes("idea.created"));
});

test("sanitizeMeta drops anything that looks like a secret", () => {
  const out = sanitizeMeta({ name: "Ada", password: "hunter2", newPassword: "x", apiKey: "k", temporaryPassword: "t", sessionToken: "s", passwordHash: "h" });
  assert.deepEqual(out, { name: "Ada" });
});

test("sanitizeMeta keeps plain values, trims long text and drops objects", () => {
  const out = sanitizeMeta({ n: 3, ok: true, none: null, long: "x".repeat(500), nested: { a: 1 }, list: ["a", 2, { b: 1 }] });
  assert.equal(out.n, 3);
  assert.equal(out.ok, true);
  assert.equal(out.none, null);
  assert.equal((out.long as string).length, 201);
  assert.equal("nested" in out, false);
  assert.deepEqual(out.list, ["a", 2]);
});

test("sanitizeMeta copes with nothing", () => {
  assert.deepEqual(sanitizeMeta(undefined), {});
});

test("sanitizeMeta keeps setting names that merely contain a secret-looking word", () => {
  const out = sanitizeMeta({ passwordMinLength: "8 → 12", passwordHistoryCount: 5, defaultMonthlyTokens: 100, hashtagCount: 2, secretary: "x" });
  assert.equal(out.passwordMinLength, "8 → 12");
  assert.equal(out.passwordHistoryCount, 5);
  assert.equal(out.defaultMonthlyTokens, 100);
  assert.equal(out.hashtagCount, 2);
  assert.equal(out.secretary, "x");
});

test("describeMeta puts the subject first and joins the rest", () => {
  assert.equal(describeMeta({ fields: ["name", "role"], role: "MEMBER → ADMIN", name: "Ada" }), "name: Ada · role: MEMBER → ADMIN · fields: name, role");
  assert.equal(describeMeta({}), "");
  assert.equal(describeMeta({ owners: [] }), "owners: none");
});
