import { test } from "node:test";
import assert from "node:assert/strict";
import { CHATBOT_TOOLS } from "@/lib/ai/chatbotToolDefs";
import { TOOL_REQUIREMENTS, toolAvailable, toolsFor } from "@/lib/ai/chatbotAccess";
import { DEFAULT_ROLE_MATRIX, resolvePermissions, type Role } from "@/lib/auth/permissions";

const perms = (role: Role) => resolvePermissions(role, DEFAULT_ROLE_MATRIX[role], []);

test("every defined tool has an explicit requirement entry", () => {
  for (const tool of CHATBOT_TOOLS) {
    assert.ok(tool.function.name in TOOL_REQUIREMENTS, `missing requirement for ${tool.function.name}`);
  }
});

test("viewer gets read tools only", () => {
  const p = perms("VIEWER");
  assert.equal(toolAvailable("list_projects", p), true);
  assert.equal(toolAvailable("create_project", p), false);
  assert.equal(toolAvailable("delete_idea", p), false);
  assert.equal(toolAvailable("generate_insights", p), false);
});

test("member can create and edit but not delete, and gets no insights", () => {
  const p = perms("MEMBER");
  assert.equal(toolAvailable("create_idea", p), true);
  assert.equal(toolAvailable("update_project", p), true);
  assert.equal(toolAvailable("delete_project", p), false);
  assert.equal(toolAvailable("list_insights", p), false);
  assert.equal(toolAvailable("promote_idea", p), true);
});

test("insight tools need ALL scope, not just OWN", () => {
  const p = resolvePermissions("MEMBER", DEFAULT_ROLE_MATRIX.MEMBER, [
    { resource: "insights", action: "view", scope: "OWN" },
  ]);
  assert.equal(toolAvailable("list_insights", p), false);
  const q = resolvePermissions("MEMBER", DEFAULT_ROLE_MATRIX.MEMBER, [
    { resource: "insights", action: "view", scope: "ALL" },
  ]);
  assert.equal(toolAvailable("list_insights", q), true);
});

test("disabling the chatbot AI feature elsewhere does not change tool tables; toolsFor filters", () => {
  const names = toolsFor(perms("VIEWER"), CHATBOT_TOOLS).map((t) => t.function.name);
  assert.ok(names.includes("list_projects"));
  assert.ok(!names.includes("create_project"));
  assert.ok(names.includes("open_page"));
});

test("admin gets every tool", () => {
  assert.equal(toolsFor(perms("ADMIN"), CHATBOT_TOOLS).length, CHATBOT_TOOLS.length);
});
