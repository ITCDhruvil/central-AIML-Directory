import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt, describePermissionSet } from "@/lib/ai/chatbotContextPrompt";
import { CHATBOT_SYSTEM_PROMPT } from "@/lib/ai/chatbotPrompts";
import { DEFAULT_ROLE_MATRIX, resolvePermissions, type PermissionSet, type Role } from "@/lib/auth/permissions";

const perms = (role: Role, grants: PermissionSet = {}): PermissionSet => ({
  ...resolvePermissions(role, DEFAULT_ROLE_MATRIX[role], []),
  ...grants,
});
const defaults: Record<Role, PermissionSet> = {
  ADMIN: perms("ADMIN"),
  MANAGER: perms("MANAGER"),
  MEMBER: perms("MEMBER"),
  VIEWER: perms("VIEWER"),
};

test("describePermissionSet lists grants with scope and the areas with no access", () => {
  const { granted, denied } = describePermissionSet(perms("MEMBER"));
  assert.ok(granted.some((l) => l.startsWith("Projects") && l.includes("view (own items only)") && l.includes("create")));
  assert.ok(granted.some((l) => l.includes("AI chatbot")));
  assert.ok(denied.includes("Insights"));
  assert.ok(denied.includes("User management"));
  assert.ok(!granted.some((l) => l.startsWith("Projects") && l.includes("delete")));
});

test("prompt starts with the base prompt and names the signed-in user and role", () => {
  const prompt = buildSystemPrompt({
    user: { name: "Ada Lovelace", email: "ada@itcube.net", role: "MEMBER", permissions: perms("MEMBER") },
    roleDefaults: defaults,
  });
  assert.ok(prompt.startsWith(CHATBOT_SYSTEM_PROMPT));
  assert.ok(prompt.includes("Ada Lovelace"));
  assert.ok(prompt.includes("Member"));
  assert.ok(prompt.includes("outside"), "tells the model to decline out-of-scope requests");
});

test("non-admins get no user-management guidance", () => {
  const prompt = buildSystemPrompt({
    user: { name: "Ada", email: "ada@itcube.net", role: "MEMBER", permissions: perms("MEMBER") },
    roleDefaults: defaults,
  });
  assert.ok(!prompt.includes("## User management"));
  assert.ok(prompt.includes("can't manage user accounts") || prompt.includes("cannot manage user accounts"));
});

test("admins get user-management guidance with roles, permission keys and questions to ask", () => {
  const prompt = buildSystemPrompt({
    user: { name: "Root", email: "root@itcube.net", role: "ADMIN", permissions: perms("ADMIN") },
    roleDefaults: defaults,
  });
  assert.ok(prompt.includes("## User management"));
  assert.ok(prompt.includes("projects:view"));
  assert.ok(prompt.includes("MANAGER") && prompt.includes("VIEWER"));
  assert.ok(prompt.includes("itcube.net"), "default username domain comes from the signed-in admin");
  assert.ok(/ask/i.test(prompt));
});

test("a delegated manager only hears about roles they may assign", () => {
  const manager = perms("MANAGER", { "users:view": "ALL", "users:create": "ALL", "users:edit": "ALL" });
  const prompt = buildSystemPrompt({
    user: { name: "Max", email: "max@itcube.net", role: "MANAGER", permissions: manager },
    roleDefaults: defaults,
  });
  assert.ok(prompt.includes("## User management"));
  assert.ok(prompt.includes("Roles you can assign"));
  assert.ok(!/Roles you can assign:[^\n]*ADMIN/.test(prompt));
});

import { suggestedPrompts } from "@/lib/ai/chatbotContextPrompt";
import { describeRequirement } from "@/lib/ai/chatbotAccess";

test("prompt teaches specific declines, including the password question", () => {
  const prompt = buildSystemPrompt({
    user: { name: "Ada", email: "ada@itcube.net", role: "MEMBER", permissions: perms("MEMBER") },
    roleDefaults: defaults,
  });
  assert.ok(prompt.includes("Declining well"));
  assert.ok(prompt.includes("scrambled (hashed)"));
  assert.ok(prompt.includes("never a stock refusal"));
});

test("suggested prompts follow permissions", () => {
  const viewer = suggestedPrompts(perms("VIEWER")).join(" ");
  assert.ok(viewer.includes("Show my projects"));
  assert.ok(!viewer.includes("Create a Member"));
  assert.ok(suggestedPrompts(perms("ADMIN")).join(" ").includes("Reset Jane"));
});

test("describeRequirement names what is missing in plain words", () => {
  assert.equal(describeRequirement("delete_project"), "permission to delete projects");
  assert.match(describeRequirement("list_insights"), /insights/);
  assert.match(describeRequirement("list_insights"), /all projects/);
  assert.match(describeRequirement("generate_insights"), /AI insights generation/i);
});
