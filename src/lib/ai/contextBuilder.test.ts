import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProjectContext, DEFAULT_CONTEXT_CHAR_BUDGET } from "@/lib/ai/contextBuilder";
import type { ContextDocument } from "@/lib/ai/types";

function doc(overrides: Partial<ContextDocument>): ContextDocument {
  return { documentId: "id", title: "Title", category: "OTHER", content: "content", ...overrides };
}

test("orders documents by category priority: README > Architecture > Setup > PRD > Design > API > Notes > rest", () => {
  const documents: ContextDocument[] = [
    doc({ documentId: "notes", category: "NOTES", title: "Notes" }),
    doc({ documentId: "api", category: "API", title: "API" }),
    doc({ documentId: "readme", category: "README", title: "Readme" }),
    doc({ documentId: "other", category: "OTHER", title: "Other" }),
    doc({ documentId: "arch", category: "ARCHITECTURE", title: "Architecture" }),
    doc({ documentId: "setup", category: "SETUP", title: "Setup" }),
    doc({ documentId: "prd", category: "PRD", title: "PRD" }),
    doc({ documentId: "design", category: "DESIGN", title: "Design" }),
  ];

  const built = buildProjectContext(documents);

  assert.deepEqual(
    built.sources.map((s) => s.documentId),
    ["readme", "arch", "setup", "prd", "design", "api", "notes", "other"],
  );
});

test("assigns stable [DOC-n] labels in inclusion order starting at 1", () => {
  const documents = [doc({ documentId: "a", category: "README" }), doc({ documentId: "b", category: "NOTES" })];
  const built = buildProjectContext(documents);

  assert.equal(built.sources[0].label, "DOC-1");
  assert.equal(built.sources[1].label, "DOC-2");
  assert.ok(built.contextText.includes("[DOC-1]"));
  assert.ok(built.contextText.includes("[DOC-2]"));
});

test("fits everything and reports no omissions when well under budget", () => {
  const documents = [doc({ documentId: "a", content: "short" })];
  const built = buildProjectContext(documents, DEFAULT_CONTEXT_CHAR_BUDGET);

  assert.equal(built.omitted.length, 0);
  assert.equal(built.truncatedLabel, null);
});

test("omits lower-priority documents that don't fit the budget, and reports them explicitly", () => {
  const documents = [
    doc({ documentId: "readme", category: "README", content: "x".repeat(80) }),
    doc({ documentId: "notes", category: "NOTES", title: "Deploy Notes", content: "y".repeat(80) }),
  ];

  // Budget only large enough for the first document's block.
  const built = buildProjectContext(documents, 150);

  assert.equal(built.sources.length, 1);
  assert.equal(built.sources[0].documentId, "readme");
  assert.equal(built.omitted.length, 1);
  assert.equal(built.omitted[0].documentId, "notes");
  assert.equal(built.omitted[0].title, "Deploy Notes");
});

test("truncates a document that partially fits instead of dropping it outright, when there's enough room to be useful", () => {
  const documents = [doc({ documentId: "readme", category: "README", content: "z".repeat(1000) })];
  const built = buildProjectContext(documents, 500);

  assert.equal(built.sources.length, 1);
  assert.equal(built.truncatedLabel, "DOC-1");
  assert.ok(built.contextText.includes("truncated"));
  assert.ok(built.contextText.length <= 500 + 50, "stays within budget plus small rendering overhead");
});

test("never silently drops a document without recording it in omitted or as truncated", () => {
  const documents = [
    doc({ documentId: "a", category: "README", content: "a".repeat(50) }),
    doc({ documentId: "b", category: "SETUP", content: "b".repeat(50) }),
    doc({ documentId: "c", category: "NOTES", content: "c".repeat(50) }),
  ];
  const built = buildProjectContext(documents, 90);

  const accountedFor = new Set([...built.sources.map((s) => s.documentId), ...built.omitted.map((o) => o.documentId)]);
  assert.equal(accountedFor.size, documents.length);
});
