import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MEMBER_ROLES,
  accessesForAction,
  canManageTeam,
  memberRoleLabel,
  validateTeam,
} from "@/lib/auth/membership";

test("view reaches every role; edit needs Owner or Contributor; delete needs Owner", () => {
  assert.deepEqual(accessesForAction("view"), ["OWNER", "EDIT", "VIEW"]);
  assert.deepEqual(accessesForAction("edit"), ["OWNER", "EDIT"]);
  assert.deepEqual(accessesForAction("create"), ["OWNER", "EDIT"]);
  assert.deepEqual(accessesForAction("delete"), ["OWNER"]);
});

test("labels read as Owner / Contributor / Viewer", () => {
  assert.equal(memberRoleLabel("OWNER"), "Owner");
  assert.equal(memberRoleLabel("EDIT"), "Contributor");
  assert.equal(memberRoleLabel("VIEW"), "Viewer");
  assert.deepEqual([...MEMBER_ROLES], ["OWNER", "EDIT", "VIEW"]);
});

test("validateTeam accepts a normal team and normalises it", () => {
  const r = validateTeam([
    { userId: "u1", role: "OWNER" },
    { userId: "u2", role: "EDIT" },
  ]);
  assert.deepEqual(r, { ok: true, members: [{ userId: "u1", role: "OWNER" }, { userId: "u2", role: "EDIT" }] });
  assert.deepEqual(validateTeam([]), { ok: true, members: [] });
});

test("validateTeam rejects bad shapes, duplicates, unknown roles and teams without an Owner", () => {
  assert.equal(validateTeam("nope").ok, false);
  assert.equal(validateTeam([{ userId: "", role: "OWNER" }]).ok, false);
  assert.equal(validateTeam([{ userId: "u1", role: "BOSS" }]).ok, false);
  assert.equal(validateTeam([{ userId: "u1", role: "OWNER" }, { userId: "u1", role: "VIEW" }]).ok, false);
  const noOwner = validateTeam([{ userId: "u1", role: "EDIT" }]);
  assert.equal(noOwner.ok, false);
  assert.match(noOwner.ok ? "" : noOwner.error, /Owner/);
});

test("who can manage a team: wide editors and the project's owners", () => {
  assert.equal(canManageTeam({ editScope: "ALL", isOwnerMember: false }), true);
  assert.equal(canManageTeam({ editScope: "OWN", isOwnerMember: true }), true);
  assert.equal(canManageTeam({ editScope: "OWN", isOwnerMember: false }), false);
  assert.equal(canManageTeam({ editScope: "NONE", isOwnerMember: true }), false);
});
