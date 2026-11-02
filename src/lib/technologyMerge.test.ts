import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeSuggestedTechnologies } from "@/lib/technologyMerge";

test("adds new suggestions once, ignoring blanks and case-insensitive duplicates", () => {
  const prev = [{ name: "React", category: "FRAMEWORK" as const, evidence: ["package.json"], confidence: "HIGH" as const }];
  const merged = mergeSuggestedTechnologies(prev, ["react", " Redis ", "redis", "", "Celery"]);
  assert.deepEqual(merged.map((t) => t.name), ["React", "Redis", "Celery"]);
  assert.equal(merged[1].category, "OTHER");
  assert.deepEqual(merged[1].evidence, ["ai-suggested"]);
});
