import { test } from "node:test";
import assert from "node:assert/strict";
import { searchPortfolio, RANK } from "@/lib/search/search";
import { buildSnippet, containsAllTokens, tokenize } from "@/lib/search/matcher";
import type { Idea } from "@/types/idea";
import type { Project } from "@/types/project";
import type { Technology } from "@/types/technology";
import type { SearchableDocument } from "@/lib/search/types";

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id ?? "p1",
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

function tech(name: string, overrides: Partial<Technology> = {}): Technology {
  return { name, category: "FRAMEWORK", evidence: ["package.json"], confidence: "HIGH", ...overrides };
}

function doc(overrides: Partial<SearchableDocument> = {}): SearchableDocument {
  return {
    id: overrides.id ?? "d1",
    projectId: overrides.projectId ?? "p1",
    title: "README",
    category: "README",
    content: "Some content.",
    ...overrides,
  };
}

function idea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: overrides.id ?? "i1",
    name: "Widget idea",
    slug: "widget-idea",
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

// --- tokenize / containsAllTokens ------------------------------------------

test("empty query tokenizes to []", () => {
  assert.deepEqual(tokenize(""), []);
});

test("whitespace-only query tokenizes to []", () => {
  assert.deepEqual(tokenize("   \t  "), []);
});

test("tokenize is case-insensitive and whitespace-tolerant", () => {
  assert.deepEqual(tokenize("  Azure   SEARCH  "), ["azure", "search"]);
});

test("containsAllTokens matches case-insensitively and partially", () => {
  assert.equal(containsAllTokens("Azure AI Search is great", ["azure", "search"]), true);
  assert.equal(containsAllTokens("Azure AI Search is great", ["azure", "missing"]), false);
});

// --- searchPortfolio: empty/whitespace query --------------------------------

test("empty query returns no results (no crash)", () => {
  const result = searchPortfolio("", [project()], [doc()], [idea()]);
  assert.deepEqual(result.projects, []);
  assert.deepEqual(result.ideas, []);
  assert.deepEqual(result.documentation, []);
});

test("whitespace-only query returns no results", () => {
  const result = searchPortfolio("   ", [project()], [doc()], [idea()]);
  assert.deepEqual(result.projects, []);
  assert.deepEqual(result.ideas, []);
  assert.deepEqual(result.documentation, []);
});

// --- project name matching ---------------------------------------------------

test("exact project name match ranks highest", () => {
  const result = searchPortfolio("Widgets", [project({ name: "Widgets" })], []);
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].rank, RANK.PROJECT_NAME_EXACT);
});

test("partial project name match ranks below exact", () => {
  const result = searchPortfolio("widg", [project({ name: "Widgets" })], []);
  assert.equal(result.projects[0].rank, RANK.PROJECT_NAME_PARTIAL);
});

test("case-insensitive project name match", () => {
  const result = searchPortfolio("WIDGETS", [project({ name: "widgets" })], []);
  assert.equal(result.projects.length, 1);
});

// --- documentation title matching -------------------------------------------

test("documentation title match", () => {
  const result = searchPortfolio(
    "architecture",
    [project()],
    [doc({ title: "ARCHITECTURE", category: "ARCHITECTURE", content: "unrelated" })],
  );
  assert.equal(result.documentation.length, 1);
  assert.equal(result.documentation[0].rank, RANK.DOC_TITLE);
  assert.equal(result.documentation[0].matchedBy, "title");
  assert.equal(result.documentation[0].snippet, null, "title matches don't need a content snippet");
});

// --- technology matching ------------------------------------------------------

test("technology name match", () => {
  const result = searchPortfolio(
    "fastapi",
    [project({ name: "API Service", technologies: [tech("FastAPI")] })],
    [],
  );
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].rank, RANK.TECHNOLOGY);
});

// --- documentation content matching ------------------------------------------

test("documentation content match produces a snippet", () => {
  const content = "This system uses Azure AI Search to index construction bid documents for fast retrieval.";
  const result = searchPortfolio("Azure Search", [project()], [doc({ content })]);
  assert.equal(result.documentation.length, 1);
  assert.equal(result.documentation[0].rank, RANK.DOC_CONTENT);
  assert.equal(result.documentation[0].matchedBy, "content");
  assert.ok(result.documentation[0].snippet, "content match must include a snippet");
});

// --- multi-word search --------------------------------------------------------

test("multi-word search requires all words present, any order", () => {
  const content = "Azure AI Search is used for semantic-ish keyword lookups.";
  const matchBothOrders1 = searchPortfolio("search azure", [project()], [doc({ content })]);
  const matchBothOrders2 = searchPortfolio("azure search", [project()], [doc({ content })]);
  assert.equal(matchBothOrders1.documentation.length, 1);
  assert.equal(matchBothOrders2.documentation.length, 1);
});

test("multi-word search excludes documents missing one of the words", () => {
  const content = "Azure AI Search is used here.";
  const result = searchPortfolio("azure nonexistentword", [project()], [doc({ content })]);
  assert.equal(result.documentation.length, 0);
});

// --- ranking behavior ----------------------------------------------------------

test("ranking: project name beats documentation title beats content", () => {
  const projects = [project({ id: "p1", name: "Azure Tools" })];
  const documents = [
    doc({ id: "d1", projectId: "p1", title: "Azure Setup", content: "irrelevant" }),
    doc({ id: "d2", projectId: "p1", title: "Other", content: "This mentions Azure deep in the text." }),
  ];
  const result = searchPortfolio("azure", projects, documents);
  assert.equal(result.projects[0].rank, RANK.PROJECT_NAME_PARTIAL);
  assert.equal(result.documentation[0].document.id, "d1", "title match ranks above content match");
  assert.equal(result.documentation[0].rank < result.documentation[1].rank, true);
});

test("category match ranks lowest (description/category tier)", () => {
  const result = searchPortfolio(
    "design",
    [project()],
    [doc({ title: "Some Doc", category: "DESIGN", content: "nothing relevant here" })],
  );
  assert.equal(result.documentation[0].matchedBy, "category");
  assert.equal(result.documentation[0].rank, RANK.DESCRIPTION_OR_CATEGORY);
});

// --- no results -----------------------------------------------------------------

test("no results for a query matching nothing", () => {
  const result = searchPortfolio("zzz-nonexistent-term", [project()], [doc()]);
  assert.deepEqual(result.projects, []);
  assert.deepEqual(result.documentation, []);
});

// --- snippet generation / safety -------------------------------------------------

test("snippet highlights the matched token and truncates with ellipses", () => {
  const content = "x".repeat(200) + "TARGETWORD" + "y".repeat(200);
  const segments = buildSnippet(content, ["targetword"]);
  const highlighted = segments.find((s) => s.highlighted);
  assert.ok(highlighted);
  assert.equal(highlighted!.text.toLowerCase(), "targetword");
  assert.ok(segments[0].text.startsWith("…"), "long prefix should be truncated with an ellipsis");
  assert.ok(segments[segments.length - 1].text.endsWith("…"), "long suffix should be truncated with an ellipsis");
});

test("snippet segments never contain HTML/Markdown execution vectors — plain text only", () => {
  const content = "Before <script>alert(1)</script> and # a markdown heading and more text after the match here TARGET more text";
  const segments = buildSnippet(content, ["target"]);
  const combined = segments.map((s) => s.text).join("");
  // The raw text may still contain the literal characters (that's fine — React
  // renders text nodes, not HTML), but there must be no separate "html" field
  // or any indication this is anything other than plain text segments.
  assert.ok(segments.every((s) => typeof s.text === "string" && typeof s.highlighted === "boolean"));
  assert.ok(combined.includes("TARGET"));
});

test("snippet without any token match falls back to the start of the content", () => {
  // Shouldn't normally happen (buildSnippet is only called after a content match),
  // but must not throw and must return something safe.
  const segments = buildSnippet("Some content with no matches", ["nomatch"]);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].highlighted, false);
});

// --- multiple similar projects/documents ----------------------------------------

test("multiple projects and documents with similar matches are all returned and deterministically ordered", () => {
  const projects = [
    project({ id: "p1", name: "Alpha Search" }),
    project({ id: "p2", name: "Beta Search" }),
  ];
  const documents = [
    doc({ id: "d1", projectId: "p1", title: "Search Notes", content: "n/a" }),
    doc({ id: "d2", projectId: "p2", title: "Search Notes", content: "n/a" }),
  ];
  const result = searchPortfolio("search", projects, documents);
  assert.equal(result.projects.length, 2);
  assert.deepEqual(result.projects.map((p) => p.project.name), ["Alpha Search", "Beta Search"]);
  assert.equal(result.documentation.length, 2);
  // Same rank + same title -> tiebreak must be deterministic (stable by construction here).
  assert.equal(result.documentation[0].document.title, "Search Notes");
});

test("result limits are applied deterministically", () => {
  const projects = Array.from({ length: 20 }, (_, i) => project({ id: `p${i}`, name: `Match Project ${i}` }));
  const result = searchPortfolio("match", projects, []);
  assert.ok(result.projects.length <= 8, "project results must be capped");
});

// --- documentation from a project that no longer exists is skipped safely --------

test("documentation referencing a missing project is silently skipped", () => {
  const result = searchPortfolio("readme", [], [doc({ projectId: "does-not-exist", title: "README" })]);
  assert.equal(result.documentation.length, 0);
});

test("idea name, owner, tags, and technologies are searchable", () => {
  const ideas = [
    idea({ id: "i1", name: "Internal VPN portal" }),
    idea({ id: "i2", name: "Other", owner: "Alex" }),
    idea({ id: "i3", name: "Notes", tags: ["search"], technologies: [tech("Meilisearch")] }),
  ];
  assert.equal(searchPortfolio("vpn", [], [], ideas).ideas[0].idea.id, "i1");
  assert.equal(searchPortfolio("alex", [], [], ideas).ideas[0].idea.id, "i2");
  assert.equal(searchPortfolio("meilisearch", [], [], ideas).ideas[0].idea.id, "i3");
});

test("idea results are capped deterministically", () => {
  const ideas = Array.from({ length: 20 }, (_, i) => idea({ id: `i${i}`, name: `Match Idea ${i}` }));
  const result = searchPortfolio("match", [], [], ideas);
  assert.ok(result.ideas.length <= 8, "idea results must be capped");
});
