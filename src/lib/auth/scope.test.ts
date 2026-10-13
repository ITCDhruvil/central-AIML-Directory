import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_ACCESS,
  NO_ACCESS,
  andWhere,
  ideaScopeWhere,
  normalizeOwnerNames,
  projectScopeWhere,
  type AccessScope,
} from "@/lib/auth/scope";

const own = (ownerNames: string[], sharedProjectIds: string[] = [], sharedIdeaIds: string[] = []): AccessScope => ({
  all: false,
  ownerNames,
  sharedProjectIds,
  sharedIdeaIds,
});

test("ALL access adds no filter", () => {
  assert.deepEqual(projectScopeWhere(ALL_ACCESS), {});
  assert.deepEqual(ideaScopeWhere(ALL_ACCESS), {});
});

test("no owner names and no shares matches nothing", () => {
  assert.deepEqual(projectScopeWhere(NO_ACCESS), { id: { in: [] } });
});

test("single owner name becomes a case-insensitive equality", () => {
  assert.deepEqual(projectScopeWhere(own(["Devika S Vinod"])), {
    owner: { equals: "Devika S Vinod", mode: "insensitive" },
  });
});

test("owner names and shared ids are OR-ed, per entity kind", () => {
  const access = own(["Ada"], ["p1"], ["i1", "i2"]);
  assert.deepEqual(projectScopeWhere(access), {
    OR: [{ owner: { equals: "Ada", mode: "insensitive" } }, { id: { in: ["p1"] } }],
  });
  assert.deepEqual(ideaScopeWhere(access), {
    OR: [{ owner: { equals: "Ada", mode: "insensitive" } }, { id: { in: ["i1", "i2"] } }],
  });
});

test("shares alone still grant access", () => {
  assert.deepEqual(projectScopeWhere(own([], ["p9"])), { id: { in: ["p9"] } });
});

test("andWhere drops empty fragments and combines the rest", () => {
  assert.deepEqual(andWhere({}, {}), {});
  assert.deepEqual(andWhere({ a: 1 }, {}), { a: 1 });
  assert.deepEqual(andWhere({ a: 1 }, { b: 2 }), { AND: [{ a: 1 }, { b: 2 }] });
});

test("normalizeOwnerNames trims, drops blanks and dedupes case-insensitively", () => {
  assert.deepEqual(normalizeOwnerNames([" Ada ", "ada", "", "  ", "Bob"]), ["Ada", "Bob"]);
});
