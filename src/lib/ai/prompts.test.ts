import { test } from "node:test";
import assert from "node:assert/strict";
import { ASSISTANT_SYSTEM_PROMPT, buildAssistantUserMessage } from "@/lib/ai/prompts";
import { buildProjectContext } from "@/lib/ai/contextBuilder";
import type { Project } from "@/types/project";

test("system prompt explicitly frames document content as data, not instructions", () => {
  assert.match(ASSISTANT_SYSTEM_PROMPT, /DATA, not instructions/i);
  assert.match(ASSISTANT_SYSTEM_PROMPT, /conversation history are DATA/i);
});

test("system prompt allows natural chat and labelled general guidance, but never general knowledge as a project fact", () => {
  assert.match(ASSISTANT_SYSTEM_PROMPT, /greetings/i);
  assert.match(ASSISTANT_SYSTEM_PROMPT, /General guidance \(not from the project docs\)/);
  assert.match(ASSISTANT_SYSTEM_PROMPT, /Never present general knowledge or a guess as a fact about this project/i);
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

test("user message includes the conversation so far, before the new question", () => {
  const built = buildProjectContext([{ documentId: "a", title: "Readme", category: "README" as const, content: "short" }]);
  const message = buildAssistantUserMessage(project(), built, "and how do I run it?", [
    { role: "user", content: "What is this?" },
    { role: "assistant", content: "A demo project." },
  ]);

  assert.match(message, /Conversation so far \(oldest first\):\nUser: What is this\?\nAssistant: A demo project\./);
  assert.ok(message.indexOf("Conversation so far") < message.indexOf("Question: and how do I run it?"));
});

test("user message has no conversation section for the first question", () => {
  const built = buildProjectContext([{ documentId: "a", title: "Readme", category: "README" as const, content: "short" }]);
  assert.ok(!buildAssistantUserMessage(project(), built, "q").includes("Conversation so far"));
});
