import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInsightsUserMessage } from "@/lib/ai/insightsPrompts";
import type { InsightsContext } from "@/lib/ai/insightsContext";

const context: InsightsContext = {
  scopedProjectName: null,
  projects: [
    {
      name: "project-management",
      status: "ACTIVE",
      tags: ["internal"],
      technologies: ["Next.js"],
      description: "Directory of AIML work.",
    },
  ],
  ideas: [],
};

test("includes existing insights so regenerate can refresh them in place", () => {
  const message = buildInsightsUserMessage(context, [
    {
      type: "improvement",
      title: "Implement semantic search with pgvector",
      suggestedTool: "pgvector",
      relatedProjectName: "project-management",
    },
  ]);
  assert.match(message, /EXISTING INSIGHTS/);
  assert.match(message, /pgvector/);
  assert.match(message, /project-management/);
  assert.match(message, /Keep suggestedTool/);
});

test("omits the existing-insights block when the directory has none yet", () => {
  const message = buildInsightsUserMessage(context);
  assert.doesNotMatch(message, /EXISTING INSIGHTS/);
});
