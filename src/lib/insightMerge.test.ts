import { test } from "node:test";
import assert from "node:assert/strict";
import type { Suggestion } from "@/lib/ai/insightsValidator";
import { insightFingerprint, planInsightMerge, summarizeMerge } from "@/lib/insightMerge";

function suggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    type: "improvement",
    title: "Add pgvector for semantic search",
    reasoning: "Unstructured text is already stored here.",
    suggestedTool: "pgvector",
    relatedProjectName: "project-management",
    sourceUrls: ["https://example.com/pgvector"],
    ...overrides,
  };
}

test("improvement fingerprint stays stable when the title is rewritten", () => {
  const original = insightFingerprint(suggestion());
  const rewritten = insightFingerprint(suggestion({ title: "Wire up semantic search with pgvector" }));
  assert.equal(original, rewritten);
  assert.equal(original, "improvement|project-management|pgvector");
});

test("new idea fingerprint stays stable when the title is rewritten", () => {
  const original = insightFingerprint(
    suggestion({ type: "new_idea", relatedProjectName: null, suggestedTool: "OAuth2", title: "Add user authentication" }),
  );
  const rewritten = insightFingerprint(
    suggestion({ type: "new_idea", relatedProjectName: null, suggestedTool: "OAuth2", title: "Sign in with OAuth2" }),
  );
  assert.equal(original, rewritten);
  assert.equal(original, "new_idea|oauth2");
});

test("first generation creates every incoming suggestion", () => {
  const incoming = [suggestion(), suggestion({ type: "new_idea", relatedProjectName: null, suggestedTool: "Celery Beat", title: "Schedule document jobs" })];
  const plan = planInsightMerge([], incoming);
  assert.equal(plan.create.length, 2);
  assert.equal(plan.update.length, 0);
  assert.deepEqual(summarizeMerge(plan), {
    addedCount: 2,
    updatedCount: 0,
    unchangedCount: 0,
    addedTitles: ["Add pgvector for semantic search", "Schedule document jobs"],
    updatedTitles: [],
  });
});

test("regenerate updates a matching card and adds a new one, keeping unmatched cards", () => {
  const existing = [
    {
      id: "i1",
      fingerprint: "improvement|project-management|pgvector",
      type: "improvement" as const,
      title: "Add pgvector for semantic search",
      reasoning: "Old reason.",
      suggestedTool: "pgvector",
      relatedProjectName: "project-management",
      sourceUrls: [],
    },
    {
      id: "i2",
      fingerprint: "new_idea|celery beat",
      type: "new_idea" as const,
      title: "Schedule document jobs",
      reasoning: "Keep this card.",
      suggestedTool: "Celery Beat",
      relatedProjectName: null,
      sourceUrls: [],
    },
  ];

  const incoming = [
    suggestion({ title: "Implement semantic search with pgvector", reasoning: "Fresh reason grounded in a search." }),
    suggestion({
      type: "new_idea",
      relatedProjectName: null,
      suggestedTool: "LangGraph",
      title: "Agent workflow for RFQs",
      reasoning: "A new card is fine.",
    }),
  ];

  const plan = planInsightMerge(existing, incoming);
  assert.equal(plan.create.length, 1);
  assert.equal(plan.create[0].suggestion.title, "Agent workflow for RFQs");
  assert.equal(plan.update.length, 1);
  assert.equal(plan.update[0].existing.id, "i1");
  assert.equal(plan.update[0].changed, true);
  assert.deepEqual(summarizeMerge(plan), {
    addedCount: 1,
    updatedCount: 1,
    unchangedCount: 0,
    addedTitles: ["Agent workflow for RFQs"],
    updatedTitles: ["Implement semantic search with pgvector"],
  });
});

test("identical incoming content is unchanged, not updated", () => {
  const item = suggestion();
  const existing = [
    {
      id: "i1",
      fingerprint: insightFingerprint(item),
      type: item.type,
      title: item.title,
      reasoning: item.reasoning,
      suggestedTool: item.suggestedTool,
      relatedProjectName: item.relatedProjectName,
      sourceUrls: item.sourceUrls,
    },
  ];
  const plan = planInsightMerge(existing, [item]);
  assert.equal(plan.update.length, 1);
  assert.equal(plan.update[0].changed, false);
  assert.deepEqual(summarizeMerge(plan), {
    addedCount: 0,
    updatedCount: 0,
    unchangedCount: 1,
    addedTitles: [],
    updatedTitles: [],
  });
});

test("duplicate fingerprints in one batch keep the first", () => {
  const plan = planInsightMerge([], [
    suggestion({ title: "First pgvector write-up" }),
    suggestion({ title: "Second pgvector write-up", reasoning: "Should be dropped." }),
  ]);
  assert.equal(plan.create.length, 1);
  assert.equal(plan.create[0].suggestion.title, "First pgvector write-up");
});

test("same title with a rewritten tool updates the existing card", () => {
  const existing = [
    {
      id: "i3",
      fingerprint: "new_idea|oauth2",
      type: "new_idea" as const,
      title: "AI-Driven Contract Analysis and Risk Assessment",
      reasoning: "Old reason.",
      suggestedTool: "OAuth2",
      relatedProjectName: null,
      sourceUrls: [],
    },
  ];
  const incoming = [
    suggestion({
      type: "new_idea",
      relatedProjectName: null,
      suggestedTool: "NLP",
      title: "AI-Driven Contract Analysis and Risk Assessment",
      reasoning: "Now grounded in contract NLP.",
    }),
  ];
  const plan = planInsightMerge(existing, incoming);
  assert.equal(plan.create.length, 0);
  assert.equal(plan.update.length, 1);
  assert.equal(plan.update[0].existing.id, "i3");
  assert.equal(plan.update[0].fingerprint, "new_idea|nlp");
  assert.equal(plan.update[0].changed, true);
});
