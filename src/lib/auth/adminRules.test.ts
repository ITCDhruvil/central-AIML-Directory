import { test } from "node:test";
import assert from "node:assert/strict";
import {
  diffAgainstDefaults,
  generateTempPassword,
  sanitizeOverrides,
  sanitizeRoleRows,
  validateNewUser,
  wouldLoseLastAdmin,
} from "@/lib/auth/adminRules";
import { DEFAULT_ROLE_MATRIX } from "@/lib/auth/permissions";
import { validatePasswordStrength } from "@/lib/auth/password";

test("sanitizeOverrides keeps valid entries, separates clears, rejects unknown keys", () => {
  const result = sanitizeOverrides({
    "projects:view": "ALL",
    "ideas:create": "NONE",
    "documents:edit": null,
  });
  assert.deepEqual(result, {
    ok: true,
    set: [
      { resource: "projects", action: "view", scope: "ALL" },
      { resource: "ideas", action: "create", scope: "NONE" },
    ],
    clear: [{ resource: "documents", action: "edit" }],
  });
  assert.equal(sanitizeOverrides({ "bogus:view": "ALL" }).ok, false);
  assert.equal(sanitizeOverrides({ "projects:fly": "ALL" }).ok, false);
  assert.equal(sanitizeOverrides({ "projects:view": "SOME" }).ok, false);
  assert.equal(sanitizeOverrides("nope").ok, false);
});

test("create/use style permissions cannot be OWN", () => {
  assert.equal(sanitizeOverrides({ "ai_chatbot:use": "OWN" }).ok, false);
  assert.equal(sanitizeOverrides({ "ideas:create": "OWN" }).ok, false);
  assert.equal(sanitizeOverrides({ "documents:create": "OWN" }).ok, true);
});

test("sanitizeRoleRows refuses to edit the ADMIN role", () => {
  assert.equal(sanitizeRoleRows("ADMIN", {}).ok, false);
  assert.equal(sanitizeRoleRows("NOPE", {}).ok, false);
  assert.equal(sanitizeRoleRows("MEMBER", { "projects:view": "ALL" }).ok, true);
});

test("diffAgainstDefaults stores only rows that differ from built-in defaults", () => {
  const rows = [
    { resource: "projects", action: "view", scope: "ALL" as const }, // member default is OWN -> differs
    { resource: "ideas", action: "create", scope: "ALL" as const }, // same as default
  ];
  assert.deepEqual(diffAgainstDefaults("MEMBER", rows), [rows[0]]);
  assert.equal(DEFAULT_ROLE_MATRIX.MEMBER.length > 0, true);
});

test("last-admin guard", () => {
  const admins = [{ id: "a", active: true }];
  assert.equal(wouldLoseLastAdmin(admins, "a", { role: "MEMBER" }), true);
  assert.equal(wouldLoseLastAdmin(admins, "a", { active: false }), true);
  assert.equal(wouldLoseLastAdmin(admins, "a", { name: "x" }), false);
  assert.equal(wouldLoseLastAdmin([...admins, { id: "b", active: true }], "a", { role: "MEMBER" }), false);
  assert.equal(wouldLoseLastAdmin([...admins, { id: "b", active: false }], "a", { active: false }), true);
  assert.equal(wouldLoseLastAdmin(admins, "other", { role: "MEMBER" }), false);
});

test("generated temp passwords satisfy the strength rule and differ", () => {
  const a = generateTempPassword();
  const b = generateTempPassword();
  assert.equal(validatePasswordStrength(a), null);
  assert.notEqual(a, b);
  assert.ok(a.length >= 12);
});

test("validateNewUser normalises and validates", () => {
  const ok = validateNewUser({ email: "  Ada@ITCube.net ", name: " Ada ", role: "MEMBER" });
  assert.deepEqual(ok, {
    ok: true,
    value: { email: "ada@itcube.net", name: "Ada", role: "MEMBER", password: null, mustChangePassword: true, overrides: [] },
  });
  assert.equal(validateNewUser({ email: "nope", name: "A", role: "MEMBER" }).ok, false);
  assert.equal(validateNewUser({ email: "a@b.co", name: "", role: "MEMBER" }).ok, false);
  assert.equal(validateNewUser({ email: "a@b.co", name: "A", role: "ROOT" }).ok, false);
});

test("validateNewUser composes first/last name and handles password, flag and overrides", () => {
  const r = validateNewUser({
    firstName: " Ada ",
    lastName: " Lovelace ",
    email: "ada@itcube.net",
    role: "VIEWER",
    password: "Goodpass1!",
    mustChangePassword: false,
    overrides: { "projects:view": "ALL", "ai_chatbot:use": "ALL" },
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.name, "Ada Lovelace");
    assert.equal(r.value.password, "Goodpass1!");
    assert.equal(r.value.mustChangePassword, false);
    assert.equal(r.value.overrides.length, 2);
  }
});

test("validateNewUser rejects blank first name, weak password and bad overrides", () => {
  const base = { firstName: "A", lastName: "B", email: "a@b.co", role: "MEMBER" };
  assert.equal(validateNewUser({ ...base, firstName: " " }).ok, false);
  assert.equal(validateNewUser({ ...base, password: "short" }).ok, false);
  assert.equal(validateNewUser({ ...base, overrides: { "ai_chatbot:use": "OWN" } }).ok, false);
});

test("admins ignore permission overrides", () => {
  const r = validateNewUser({ name: "Root", email: "r@b.co", role: "ADMIN", overrides: { "projects:view": "NONE" } });
  assert.equal(r.ok && r.value.overrides.length, 0);
});

import { assignableRoles, escalationError, touchesAdmin } from "@/lib/auth/adminRules";
import { resolvePermissions, type PermissionSet, type Role } from "@/lib/auth/permissions";

const defaultsFor = (): Record<Role, PermissionSet> => ({
  ADMIN: resolvePermissions("ADMIN", DEFAULT_ROLE_MATRIX.ADMIN, []),
  MANAGER: resolvePermissions("MANAGER", DEFAULT_ROLE_MATRIX.MANAGER, []),
  MEMBER: resolvePermissions("MEMBER", DEFAULT_ROLE_MATRIX.MEMBER, []),
  VIEWER: resolvePermissions("VIEWER", DEFAULT_ROLE_MATRIX.VIEWER, []),
});
const actor = (role: Role, grants: PermissionSet = {}) => ({
  role,
  permissions: { ...defaultsFor()[role], ...grants },
});

test("admins can assign anything", () => {
  assert.equal(escalationError(actor("ADMIN"), "ADMIN", [], defaultsFor()), null);
  assert.deepEqual(assignableRoles(actor("ADMIN"), defaultsFor()), ["ADMIN", "MANAGER", "MEMBER", "VIEWER"]);
});

test("non-admins cannot assign Admin or exceed their own access", () => {
  const manager = actor("MANAGER", { "users:view": "ALL", "users:create": "ALL", "users:edit": "ALL" });
  assert.match(escalationError(manager, "ADMIN", [], defaultsFor()) ?? "", /Admin role/);
  // A manager's own access is below Admin (no users:delete etc.), so only roles at or below it are on offer.
  assert.deepEqual(assignableRoles(manager, defaultsFor()), ["MANAGER", "MEMBER", "VIEWER"].filter((r) => escalationError(manager, r as Role, [], defaultsFor()) === null));
  const viewer = actor("VIEWER", { "users:create": "ALL" });
  assert.equal(escalationError(viewer, "MEMBER", [], defaultsFor()) !== null, true);
  assert.equal(escalationError(viewer, "VIEWER", [], defaultsFor()), null);
});

test("overrides above the actor's own scope are refused, at-or-below are fine", () => {
  const member = actor("MEMBER", { "users:create": "ALL" });
  assert.notEqual(escalationError(member, "VIEWER", [{ resource: "projects", action: "view", scope: "ALL" }], defaultsFor()), null);
  assert.equal(escalationError(member, "VIEWER", [{ resource: "projects", action: "view", scope: "OWN" }], defaultsFor()), null);
  assert.notEqual(escalationError(member, "VIEWER", [{ resource: "ideas", action: "delete", scope: "OWN" }], defaultsFor()), null);
});

test("touchesAdmin only blocks non-admins", () => {
  assert.equal(touchesAdmin(actor("MANAGER"), "ADMIN"), true);
  assert.equal(touchesAdmin(actor("ADMIN"), "ADMIN"), false);
  assert.equal(touchesAdmin(actor("MANAGER"), "MEMBER"), false);
});
