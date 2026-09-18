import { test } from "node:test";
import assert from "node:assert/strict";
import { applyClientFilters, sortProjects } from "@/lib/projectExplorer";
import { deploymentLabel, hasInternalDeployment, isInternalDeploymentUrl, primaryDeploymentUrl } from "@/lib/deploymentLabel";
import { groupTechnologiesByCategory, isManualTechnology } from "@/lib/technologyGroups";
import type { Project } from "@/types/project";
import type { Technology } from "@/types/technology";

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id ?? "p1",
    name: "widgets",
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

function tech(name: string, overrides: Partial<Technology> = {}): Technology {
  return { name, category: "FRAMEWORK", evidence: ["package.json"], confidence: "HIGH", ...overrides };
}

// --- Sorting -----------------------------------------------------------

test("sort: Recently Updated (default) orders by updatedAt desc", () => {
  const projects = [
    project({ id: "a", updatedAt: "2026-01-01T00:00:00.000Z" }),
    project({ id: "b", updatedAt: "2026-03-01T00:00:00.000Z" }),
    project({ id: "c", updatedAt: "2026-02-01T00:00:00.000Z" }),
  ];
  const sorted = sortProjects(projects, "updated-desc");
  assert.deepEqual(sorted.map((p) => p.id), ["b", "c", "a"]);
});

test("sort: Recently Created orders by createdAt desc", () => {
  const projects = [
    project({ id: "a", createdAt: "2026-01-01T00:00:00.000Z" }),
    project({ id: "b", createdAt: "2026-03-01T00:00:00.000Z" }),
  ];
  const sorted = sortProjects(projects, "created-desc");
  assert.deepEqual(sorted.map((p) => p.id), ["b", "a"]);
});

test("sort: Name A-Z and Z-A", () => {
  const projects = [project({ id: "a", name: "Zebra" }), project({ id: "b", name: "Apple" })];
  assert.deepEqual(sortProjects(projects, "name-asc").map((p) => p.id), ["b", "a"]);
  assert.deepEqual(sortProjects(projects, "name-desc").map((p) => p.id), ["a", "b"]);
});

test("sort: Last Synced — never-synced projects sink to the bottom", () => {
  const projects = [
    project({ id: "never", lastSyncedAt: null }),
    project({ id: "recent", lastSyncedAt: "2026-03-01T00:00:00.000Z" }),
    project({ id: "older", lastSyncedAt: "2026-01-01T00:00:00.000Z" }),
  ];
  const sorted = sortProjects(projects, "last-synced");
  assert.deepEqual(sorted.map((p) => p.id), ["recent", "older", "never"]);
});

test("sort: Last Synced with multiple never-synced projects doesn't crash and keeps them all at the bottom", () => {
  const projects = [
    project({ id: "never1", lastSyncedAt: null }),
    project({ id: "synced", lastSyncedAt: "2026-02-01T00:00:00.000Z" }),
    project({ id: "never2", lastSyncedAt: null }),
  ];
  const sorted = sortProjects(projects, "last-synced");
  assert.equal(sorted[0].id, "synced");
  assert.deepEqual(new Set(sorted.slice(1).map((p) => p.id)), new Set(["never1", "never2"]));
});

// --- Client-side filters -------------------------------------------------
// Technology is no longer a separate client-side filter — the global search
// endpoint (src/lib/search/search.ts) already matches technology names, so
// typing a technology into the one search box covers it server-side.

test("GitHub-connected filter keeps only projects with a githubUrl", () => {
  const projects = [
    project({ id: "a", githubUrl: "https://github.com/acme/a" }),
    project({ id: "b", githubUrl: null }),
  ];
  const filtered = applyClientFilters(projects, { githubConnectedOnly: true });
  assert.deepEqual(filtered.map((p) => p.id), ["a"]);
});

test("without githubConnectedOnly, every project passes through unchanged", () => {
  const projects = [project({ id: "a" }), project({ id: "b", githubUrl: "https://github.com/acme/b" })];
  assert.deepEqual(applyClientFilters(projects, {}).map((p) => p.id), ["a", "b"]);
});

// --- Deployment labels ---------------------------------------------------

test("deploymentLabel derives Local/Staging/UAT/Production from the URL, falls back to hostname", () => {
  assert.equal(deploymentLabel("http://localhost:3000"), "Local");
  assert.equal(deploymentLabel("https://staging.myapp.com"), "Staging");
  assert.equal(deploymentLabel("https://myapp-uat.azurewebsites.net"), "UAT");
  assert.equal(deploymentLabel("https://myapp-prod.azurewebsites.net"), "Production");
  assert.equal(deploymentLabel("https://myapp.vercel.app"), "myapp.vercel.app");
  assert.equal(deploymentLabel("http://10.0.0.12:8080"), "Internal");
});

test("isInternalDeploymentUrl flags private IPs and internal hostnames, not public or local", () => {
  assert.equal(isInternalDeploymentUrl("http://10.0.0.12:8080"), true);
  assert.equal(isInternalDeploymentUrl("http://192.168.1.20"), true);
  assert.equal(isInternalDeploymentUrl("https://app.internal.company.com"), true);
  assert.equal(isInternalDeploymentUrl("http://intranet"), true);
  assert.equal(isInternalDeploymentUrl("http://jenkins:8080"), true);
  assert.equal(isInternalDeploymentUrl("https://tools.corp.local"), true);
  assert.equal(isInternalDeploymentUrl("http://localhost:3000"), false);
  assert.equal(isInternalDeploymentUrl("https://myapp.vercel.app"), false);
  assert.equal(isInternalDeploymentUrl("https://app.example.com"), false);
  assert.equal(isInternalDeploymentUrl("https://fdic.gov"), false);
  assert.equal(isInternalDeploymentUrl("http://[fd12:3456:789a:1::1]/"), true);
});

test("hasInternalDeployment is true when any URL is internal", () => {
  assert.equal(hasInternalDeployment(["https://app.example.com", "http://10.1.1.4"]), true);
  assert.equal(hasInternalDeployment(["https://app.example.com"]), false);
  assert.equal(hasInternalDeployment([]), false);
});

test("primaryDeploymentUrl prefers a public deploy, then falls back to the first URL", () => {
  assert.equal(primaryDeploymentUrl([]), null);
  assert.equal(primaryDeploymentUrl(["https://app.example.com"]), "https://app.example.com");
  assert.equal(primaryDeploymentUrl(["http://10.1.1.4", "https://app.example.com"]), "https://app.example.com");
  assert.equal(primaryDeploymentUrl(["http://10.1.1.4"]), "http://10.1.1.4");
});

// --- Technology grouping --------------------------------------------------

test("groupTechnologiesByCategory groups by category and preserves entries", () => {
  const technologies = [tech("Next.js", { category: "FRAMEWORK" }), tech("Python", { category: "LANGUAGE" }), tech("React", { category: "FRAMEWORK" })];
  const groups = groupTechnologiesByCategory(technologies);
  const byCategory = Object.fromEntries(groups);
  assert.equal(byCategory.FRAMEWORK.length, 2);
  assert.equal(byCategory.LANGUAGE.length, 1);
});

test("isManualTechnology identifies manually-added entries without exposing raw evidence elsewhere", () => {
  const manual = tech("Docker", { evidence: ["manual"] });
  const detected = tech("React", { evidence: ["package.json"] });
  assert.equal(isManualTechnology(manual), true);
  assert.equal(isManualTechnology(detected), false);
});
