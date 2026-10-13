import { test } from "node:test";
import assert from "node:assert/strict";
import { withOwnerDefault } from "@/lib/auth/ownerDefault";
import { DEFAULT_ROLE_MATRIX, resolvePermissions } from "@/lib/auth/permissions";

const member = {
  name: "Ada Lovelace",
  permissions: resolvePermissions("MEMBER", DEFAULT_ROLE_MATRIX.MEMBER, []),
};
const manager = {
  name: "Max Manager",
  permissions: resolvePermissions("MANAGER", DEFAULT_ROLE_MATRIX.MANAGER, []),
};

test("scoped user: blank owner defaults to the user's name", () => {
  assert.deepEqual(withOwnerDefault({ name: "X" }, member, "projects"), { name: "X", owner: "Ada Lovelace" });
  assert.deepEqual(withOwnerDefault({ name: "X", owner: "  " }, member, "ideas"), { name: "X", owner: "Ada Lovelace" });
});

test("scoped user: an explicit owner is kept", () => {
  assert.deepEqual(withOwnerDefault({ name: "X", owner: "Bob" }, member, "projects"), { name: "X", owner: "Bob" });
});

test("user who sees everything gets no default", () => {
  assert.deepEqual(withOwnerDefault({ name: "X" }, manager, "projects"), { name: "X" });
});

test("non-object input passes through untouched", () => {
  assert.equal(withOwnerDefault(null, member, "projects"), null);
  assert.equal(withOwnerDefault("x", member, "projects"), "x");
});
