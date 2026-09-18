import { test } from "node:test";
import assert from "node:assert/strict";
import { portfolioSnapshot } from "@/lib/portfolioSnapshot";
import type { Project } from "@/types/project";

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    name: "Widgets",
    slug: "widgets",
    description: null,
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
    ...overrides,
  };
}

test("empty catalog is all zeros", () => {
  assert.deepEqual(portfolioSnapshot([]), {
    total: 0,
    byStatus: { ACTIVE: 0, COMPLETED: 0, ON_HOLD: 0, ARCHIVED: 0 },
    github: 0,
    reachable: 0,
    internal: 0,
    poc: 0,
  });
});

test("counts status mix, github, live URLs, internal, and POC type", () => {
  const result = portfolioSnapshot([
    project({ id: "1", status: "ACTIVE", githubUrl: "https://github.com/a/b", deploymentUrls: ["https://example.com"] }),
    project({ id: "2", status: "COMPLETED", type: "POC", deploymentUrls: ["http://192.168.1.10"] }),
    project({ id: "3", status: "ON_HOLD" }),
  ]);
  assert.equal(result.total, 3);
  assert.equal(result.byStatus.ACTIVE, 1);
  assert.equal(result.byStatus.COMPLETED, 1);
  assert.equal(result.byStatus.ON_HOLD, 1);
  assert.equal(result.github, 1);
  assert.equal(result.reachable, 2);
  assert.equal(result.internal, 1);
  assert.equal(result.poc, 1);
});
