import assert from "node:assert/strict";
import test from "node:test";
import { filterToParams, parseAuditFilter } from "@/lib/auditFilter";

const from = (obj: Record<string, string>) => parseAuditFilter((k) => obj[k] ?? null);

test("no parameters means no restriction, first page", () => {
  assert.deepEqual(from({}), { actions: null, actorId: null, q: "", days: null, page: 1 });
});

test("a category expands to its actions", () => {
  const f = from({ category: "Projects" });
  assert.deepEqual(f.actions?.sort(), ["project.created", "project.deleted", "project.updated"]);
});

test("a specific action wins over a category", () => {
  assert.deepEqual(from({ category: "Projects", action: "auth.login" }).actions, ["auth.login"]);
});

test("unknown categories and actions are ignored, not trusted", () => {
  assert.equal(from({ category: "Nope" }).actions, null);
  assert.equal(from({ action: "drop.table" }).actions, null);
});

test("only the offered periods are accepted", () => {
  assert.equal(from({ days: "7" }).days, 7);
  assert.equal(from({ days: "9999" }).days, null);
  assert.equal(from({ days: "abc" }).days, null);
});

test("page must be a positive whole number", () => {
  assert.equal(from({ page: "3" }).page, 3);
  assert.equal(from({ page: "0" }).page, 1);
  assert.equal(from({ page: "-2" }).page, 1);
  assert.equal(from({ page: "1.5" }).page, 1);
});

test("search text is trimmed and capped", () => {
  assert.equal(from({ q: "  ada  " }).q, "ada");
  assert.equal(from({ q: "x".repeat(300) }).q.length, 100);
});

test("filterToParams leaves out defaults", () => {
  assert.equal(filterToParams({}).toString(), "");
  assert.equal(filterToParams({ category: "Settings", days: 30, page: 2, q: "ai" }).toString(), "category=Settings&q=ai&days=30&page=2");
});
