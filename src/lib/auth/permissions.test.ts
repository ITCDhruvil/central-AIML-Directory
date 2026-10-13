import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ROLE_MATRIX,
  can,
  permissionKey,
  resolvePermissions,
  scopeFor,
} from "@/lib/auth/permissions";

test("admin has ALL scope on every permission", () => {
  const perms = resolvePermissions("ADMIN", DEFAULT_ROLE_MATRIX.ADMIN, []);
  for (const scope of Object.values(perms)) assert.equal(scope, "ALL");
});

test("viewer can only view, scoped to own", () => {
  const perms = resolvePermissions("VIEWER", DEFAULT_ROLE_MATRIX.VIEWER, []);
  assert.equal(scopeFor(perms, "projects", "view"), "OWN");
  assert.equal(can(perms, "projects", "view"), true);
  assert.equal(can(perms, "projects", "create"), false);
  assert.equal(can(perms, "projects", "edit"), false);
  assert.equal(can(perms, "projects", "delete"), false);
});

test("member can create, edit own, but not delete", () => {
  const perms = resolvePermissions("MEMBER", DEFAULT_ROLE_MATRIX.MEMBER, []);
  assert.equal(can(perms, "ideas", "create"), true);
  assert.equal(scopeFor(perms, "ideas", "edit"), "OWN");
  assert.equal(can(perms, "ideas", "delete"), false);
});

test("manager sees all projects but cannot manage users", () => {
  const perms = resolvePermissions("MANAGER", DEFAULT_ROLE_MATRIX.MANAGER, []);
  assert.equal(scopeFor(perms, "projects", "view"), "ALL");
  assert.equal(can(perms, "users", "view"), false);
});

test("user override beats role default in both directions", () => {
  const overrides = [
    { resource: "projects", action: "view", scope: "ALL" as const },
    { resource: "ideas", action: "create", scope: "NONE" as const },
  ];
  const perms = resolvePermissions("MEMBER", DEFAULT_ROLE_MATRIX.MEMBER, overrides);
  assert.equal(scopeFor(perms, "projects", "view"), "ALL");
  assert.equal(can(perms, "ideas", "create"), false);
});

test("unknown permission key resolves to NONE", () => {
  const perms = resolvePermissions("ADMIN", DEFAULT_ROLE_MATRIX.ADMIN, []);
  assert.equal(scopeFor(perms, "nope", "view"), "NONE");
  assert.equal(can(perms, "nope", "view"), false);
});

test("role rows from the database replace the built-in defaults", () => {
  const dbRows = [{ resource: "projects", action: "view", scope: "NONE" as const }];
  const perms = resolvePermissions("MEMBER", DEFAULT_ROLE_MATRIX.MEMBER, [], dbRows);
  assert.equal(can(perms, "projects", "view"), false);
  assert.equal(can(perms, "ideas", "create"), true);
});

test("ai feature toggles use the 'use' action", () => {
  const member = resolvePermissions("MEMBER", DEFAULT_ROLE_MATRIX.MEMBER, []);
  const viewer = resolvePermissions("VIEWER", DEFAULT_ROLE_MATRIX.VIEWER, []);
  assert.equal(can(member, "ai_chatbot", "use"), true);
  assert.equal(can(viewer, "ai_chatbot", "use"), false);
});

test("permissionKey is stable", () => {
  assert.equal(permissionKey("projects", "view"), "projects:view");
});
