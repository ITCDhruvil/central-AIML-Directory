import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestionToIdeaInput } from "@/lib/insightsToIdea";
import type { Suggestion } from "@/lib/ai/insightsValidator";

const BASE: Suggestion = {
  type: "new_idea",
  title: "Ambient meeting notes",
  reasoning: "Speech-to-text models are now fast/cheap enough to run this live.",
  suggestedTool: "Whisper",
  relatedProjectName: null,
  sourceUrls: [],
};

test("maps title/status/tags for a new_idea suggestion", () => {
  const input = suggestionToIdeaInput(BASE);
  assert.equal(input.name, "Ambient meeting notes");
  assert.equal(input.status, "ACTIVE");
  assert.deepEqual(input.tags, ["ai-suggested", "new-idea"]);
  assert.deepEqual(input.technologies, [{ name: "Whisper", category: "OTHER", evidence: ["ai-suggested"], confidence: "MEDIUM" }]);
});

test("tags an improvement suggestion differently", () => {
  const input = suggestionToIdeaInput({ ...BASE, type: "improvement", relatedProjectName: "My Project" });
  assert.deepEqual(input.tags, ["ai-suggested", "improvement"]);
  assert.match(input.description ?? "", /Relates to.*My Project/);
});

test("description includes reasoning, tool, and sources", () => {
  const input = suggestionToIdeaInput({ ...BASE, sourceUrls: ["https://a.com", "https://b.com"] });
  assert.match(input.description ?? "", /Speech-to-text models/);
  assert.match(input.description ?? "", /Suggested tool.*Whisper/);
  assert.match(input.description ?? "", /https:\/\/a\.com/);
  assert.match(input.description ?? "", /https:\/\/b\.com/);
});

test("omits technologies when no tool was suggested", () => {
  const input = suggestionToIdeaInput({ ...BASE, suggestedTool: null });
  assert.deepEqual(input.technologies, []);
});
