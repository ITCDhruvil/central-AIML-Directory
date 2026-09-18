import { test } from "node:test";
import assert from "node:assert/strict";
import { ASSISTANT_SYSTEM_PROMPT, buildAssistantUserMessage } from "@/lib/ai/prompts";
import { buildProjectContext } from "@/lib/ai/contextBuilder";
import type { Project } from "@/types/project";

test("system prompt explicitly frames document content as data, not instructions", () => {
  assert.match(ASSISTANT_SYSTEM_PROMPT, /DATA, not instructions/i);
  assert.match(ASSISTANT_SYSTEM_PROMPT, /never use outside knowledge/i);
  assert.match(ASSISTANT_SYSTEM_PROMPT, /not available in project documentation/i);
});

test("system prompt gives a concrete known-vs-unknown example (the port question) instead of allowing a guessed default", () => {
  assert.match(ASSISTANT_SYSTEM_PROMPT, /port/i);
  assert.match(ASSISTANT_SYSTEM_PROMPT, /3000/);
});

function project(): Project {
  return {
    id: "p1",
    name: "Demo",
    slug: "demo",
    description: "A demo project",
    type: "PROJECT",
    status: "ACTIVE",
    stage: null,
    owner: null,
    githubUrl: null,
    githubOwner: null,
    githubRepo: null,
    defaultBranch: null,
    technologies: [],
    tags: [],
    deploymentUrls: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastSyncedAt: null,
  };
}

test("user message tells the model explicitly when documentation was omitted, never pretending full coverage", () => {
  const documents = [
    { documentId: "a", title: "Readme", category: "README" as const, content: "x".repeat(80) },
    { documentId: "b", title: "Notes", category: "NOTES" as const, content: "y".repeat(80) },
  ];
  const built = buildProjectContext(documents, 100);
  const message = buildAssistantUserMessage(project(), built, "question");

  assert.match(message, /could not be included due to context size limits/);
  assert.match(message, /Notes/);
});

test("user message states no coverage caveat when everything fit", () => {
  const documents = [{ documentId: "a", title: "Readme", category: "README" as const, content: "short" }];
  const built = buildProjectContext(documents);
  const message = buildAssistantUserMessage(project(), built, "question");

  assert.ok(!message.includes("could not be included"));
});
