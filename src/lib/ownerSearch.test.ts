import { test } from "node:test";
import assert from "node:assert/strict";
import { ownerNameMatches, ownerPrismaClause, tokenizePersonQuery } from "@/lib/ownerSearch";

test("tokenizePersonQuery splits on whitespace", () => {
  assert.deepEqual(tokenizePersonQuery("  Devika   S  Vinod "), ["Devika", "S", "Vinod"]);
  assert.deepEqual(tokenizePersonQuery(""), []);
});

test("ownerNameMatches: first name finds a full owner string", () => {
  assert.equal(ownerNameMatches("Devika S Vinod", "Devika"), true);
  assert.equal(ownerNameMatches("Devika S Vinod", "devika"), true);
  assert.equal(ownerNameMatches("Devika S Vinod", "Vinod"), true);
  assert.equal(ownerNameMatches("Devika S Vinod", "Devika Vinod"), true);
});

test("ownerNameMatches: prefix of a name part matches", () => {
  assert.equal(ownerNameMatches("Devika S Vinod", "Dev"), true);
});

test("ownerNameMatches: unrelated names do not match", () => {
  assert.equal(ownerNameMatches("Devika S Vinod", "Arun"), false);
  assert.equal(ownerNameMatches("Ada Lovelace", "Devika"), false);
  assert.equal(ownerNameMatches("", "Devika"), false);
});

test("ownerPrismaClause: single token is a contains filter", () => {
  assert.deepEqual(ownerPrismaClause("Devika"), {
    owner: { contains: "Devika", mode: "insensitive" },
  });
});

test("ownerPrismaClause: multiple tokens AND together", () => {
  assert.deepEqual(ownerPrismaClause("Devika Vinod"), {
    AND: [
      { owner: { contains: "Devika", mode: "insensitive" } },
      { owner: { contains: "Vinod", mode: "insensitive" } },
    ],
  });
});
