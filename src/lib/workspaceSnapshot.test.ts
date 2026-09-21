import { test } from "node:test";
import assert from "node:assert/strict";
import { ideasSnapshot, insightsPulse, takeRecent } from "@/lib/workspaceSnapshot";
import type { Idea } from "@/types/idea";
import type { Insight, InsightSnapshot } from "@/types/insight";

function idea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "i1",
    name: "Widget",
    slug: "widget",
    description: null,
    status: "ACTIVE",
    owner: null,
    technologies: [],
    tags: [],
    promotedProjectId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function insight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: "n1",
    scope: "catalog",
    type: "new_idea",
    title: "Try RAG",
    reasoning: "Worth a look",
    suggestedTool: null,
    relatedProjectName: null,
    sourceUrls: [],
    savedAsIdea: false,
    lastChange: "added",
    firstGeneratedAt: "2026-01-01T00:00:00.000Z",
    lastGeneratedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("empty ideas catalog is all zeros", () => {
  assert.deepEqual(ideasSnapshot([]), {
    total: 0,
    byStatus: { ACTIVE: 0, ON_HOLD: 0, PROMOTED: 0, ARCHIVED: 0 },
  });
});

test("counts idea status mix", () => {
  const result = ideasSnapshot([
    idea({ id: "1", status: "ACTIVE" }),
    idea({ id: "2", status: "PROMOTED" }),
    idea({ id: "3", status: "ON_HOLD" }),
    idea({ id: "4", status: "ACTIVE" }),
  ]);
  assert.equal(result.total, 4);
  assert.equal(result.byStatus.ACTIVE, 2);
  assert.equal(result.byStatus.PROMOTED, 1);
  assert.equal(result.byStatus.ON_HOLD, 1);
  assert.equal(result.byStatus.ARCHIVED, 0);
});

test("empty insights pulse is zeros", () => {
  const empty: InsightSnapshot = { insights: [], generation: null };
  assert.deepEqual(insightsPulse(empty), {
    total: 0,
    newIdeas: 0,
    improvements: 0,
    unsaved: 0,
    lastGeneratedAt: null,
  });
});

test("counts insight types, unsaved, and last generated", () => {
  const result = insightsPulse({
    insights: [
      insight({ id: "a", type: "new_idea", savedAsIdea: false }),
      insight({ id: "b", type: "improvement", savedAsIdea: true }),
      insight({ id: "c", type: "new_idea", savedAsIdea: true }),
    ],
    generation: {
      id: "g1",
      scope: "catalog",
      generatedAt: "2026-09-15T12:00:00.000Z",
      addedCount: 2,
      updatedCount: 1,
      unchangedCount: 0,
      addedTitles: [],
      updatedTitles: [],
    },
  });
  assert.equal(result.total, 3);
  assert.equal(result.newIdeas, 2);
  assert.equal(result.improvements, 1);
  assert.equal(result.unsaved, 1);
  assert.equal(result.lastGeneratedAt, "2026-09-15T12:00:00.000Z");
});

test("takeRecent sorts newest first and caps the list", () => {
  const items = [
    { id: 1, at: "2026-01-01T00:00:00.000Z" },
    { id: 2, at: "2026-03-01T00:00:00.000Z" },
    { id: 3, at: "2026-02-01T00:00:00.000Z" },
  ];
  assert.deepEqual(
    takeRecent(items, (item) => item.at, 2).map((item) => item.id),
    [2, 3],
  );
});
