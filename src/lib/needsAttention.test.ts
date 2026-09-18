import { test } from "node:test";
import assert from "node:assert/strict";
import { getNeedsAttentionIssues } from "@/lib/needsAttention";
import { deploymentUrlsChanged } from "@/lib/projectActivity";
import type { Project } from "@/types/project";

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    name: "widgets",
    slug: "widgets",
    description: "A demo project",
    type: "PROJECT",
    status: "ACTIVE",
    stage: "DEVELOPMENT",
    owner: "Ada",
    githubUrl: "https://github.com/acme/widgets",
    githubOwner: "acme",
    githubRepo: "widgets",
    defaultBranch: "main",
    technologies: [],
    tags: [],
    deploymentUrls: ["https://widgets.example.com"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastSyncedAt: null,
    ...overrides,
  };
}

test("needs attention: empty when description, deployment, and GitHub are present", () => {
  assert.equal(getNeedsAttentionIssues(project()).length, 0);
});

test("needs attention: flags missing description", () => {
  const issues = getNeedsAttentionIssues(project({ description: null }));
  assert.equal(issues.some((i) => i.id === "missing-description"), true);
});

test("needs attention: flags missing deployment URL", () => {
  const issues = getNeedsAttentionIssues(project({ deploymentUrls: [] }));
  assert.equal(issues.some((i) => i.id === "missing-deployment"), true);
});

test("needs attention: flags missing GitHub owner/repo", () => {
  const issues = getNeedsAttentionIssues(
    project({ githubOwner: null, githubRepo: null, githubUrl: null }),
  );
  assert.equal(issues.some((i) => i.id === "github-not-connected"), true);
});

test("needs attention: does not flag GitHub when only URL is missing but owner/repo exist", () => {
  const issues = getNeedsAttentionIssues(project({ githubUrl: null }));
  assert.equal(issues.some((i) => i.id === "github-not-connected"), false);
});

test("deploymentUrlsChanged: detects add/remove and treats order as irrelevant", () => {
  assert.equal(deploymentUrlsChanged(["a", "b"], ["b", "a"]), false);
  assert.equal(deploymentUrlsChanged(["a"], ["a", "b"]), true);
  assert.equal(deploymentUrlsChanged(["a"], ["b"]), true);
});
