import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIdeaWhere } from "@/lib/ideas";
import { buildInsightWhere } from "@/lib/insightCatalog";
import { buildDocumentationWhere } from "@/lib/documents";
import { buildActivityWhere } from "@/lib/projectActivity";
import { buildProjectWhere } from "@/lib/projects";
import {
  DOCUMENT_SEARCH_FIELDS,
  IDEA_SEARCH_FIELDS,
  INSIGHT_SEARCH_FIELDS,
  PROJECT_ACTIVITY_SEARCH_FIELDS,
  PROJECT_SEARCH_FIELDS,
  containsInsensitive,
  orContainsFields,
} from "@/lib/schemaSearch";

function orBranches(where: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(where.OR)) return where.OR as Record<string, unknown>[];
  const and = where.AND as Record<string, unknown>[] | undefined;
  const nested = and?.find((clause) => Array.isArray(clause.OR));
  if (nested && Array.isArray(nested.OR)) return nested.OR as Record<string, unknown>[];
  return [];
}

function scalarFieldsInOr(where: Record<string, unknown>): string[] {
  return orBranches(where)
    .flatMap((branch) => Object.keys(branch))
    .filter((key) => key !== "documentation" && key !== "activities" && key !== "AND");
}

test("containsInsensitive is a case-insensitive substring filter", () => {
  assert.deepEqual(containsInsensitive("React"), { contains: "React", mode: "insensitive" });
});

test("orContainsFields builds one contains clause per field", () => {
  assert.deepEqual(orContainsFields(["name", "slug"], "BuildTrack"), [
    { name: { contains: "BuildTrack", mode: "insensitive" } },
    { slug: { contains: "BuildTrack", mode: "insensitive" } },
  ]);
});

test("orContainsFields ignores blank queries", () => {
  assert.deepEqual(orContainsFields(["name"], "   "), []);
});

test("project search fields cover every Project text/json column", () => {
  const expected = [
    "name",
    "slug",
    "description",
    "type",
    "status",
    "stage",
    "owner",
    "githubUrl",
    "githubOwner",
    "githubRepo",
    "defaultBranch",
    "technologies",
    "tags",
    "deploymentUrls",
  ];
  assert.deepEqual([...PROJECT_SEARCH_FIELDS].sort(), [...expected].sort());
});

test("idea search fields cover every Idea text/json column", () => {
  const expected = [
    "name",
    "slug",
    "description",
    "status",
    "owner",
    "technologies",
    "tags",
    "promotedProjectId",
  ];
  assert.deepEqual([...IDEA_SEARCH_FIELDS].sort(), [...expected].sort());
});

test("insight and document search fields cover the remaining catalog text", () => {
  assert.ok(INSIGHT_SEARCH_FIELDS.includes("title"));
  assert.ok(INSIGHT_SEARCH_FIELDS.includes("reasoning"));
  assert.ok(INSIGHT_SEARCH_FIELDS.includes("suggestedTool"));
  assert.ok(INSIGHT_SEARCH_FIELDS.includes("relatedProjectName"));
  assert.ok(INSIGHT_SEARCH_FIELDS.includes("sourceUrls"));
  assert.ok(DOCUMENT_SEARCH_FIELDS.includes("content"));
  assert.ok(DOCUMENT_SEARCH_FIELDS.includes("filePath"));
  assert.ok(PROJECT_ACTIVITY_SEARCH_FIELDS.includes("title"));
});

test("buildProjectWhere q searches every project field plus docs and activity", () => {
  const where = buildProjectWhere({ q: "react" }) as Record<string, unknown>;
  const fields = new Set(scalarFieldsInOr(where));
  for (const field of PROJECT_SEARCH_FIELDS) {
    assert.ok(fields.has(field), `missing project field ${field}`);
  }
  const docs = orBranches(where).find((branch) => branch.documentation);
  const activity = orBranches(where).find((branch) => branch.activities);
  assert.ok(docs, "project search should include related documentation");
  assert.ok(activity, "project search should include related activity");
});

test("buildProjectWhere still filters by type, status, stage, tag, technology", () => {
  const where = buildProjectWhere({
    type: "POC",
    status: "ACTIVE",
    stage: "PRODUCTION",
    tag: "internal",
    technology: "FastAPI",
  }) as Record<string, unknown>;
  const and = where.AND as Record<string, unknown>[];
  assert.ok(and.some((clause) => clause.type === "POC"));
  assert.ok(and.some((clause) => clause.status === "ACTIVE"));
  assert.ok(and.some((clause) => clause.stage === "PRODUCTION"));
  assert.ok(and.some((clause) => JSON.stringify(clause).includes("internal")));
  assert.ok(and.some((clause) => JSON.stringify(clause).includes("FastAPI")));
});

test("buildIdeaWhere q searches every idea field", () => {
  const where = buildIdeaWhere({ q: "rag" }) as Record<string, unknown>;
  const fields = new Set(scalarFieldsInOr(where));
  for (const field of IDEA_SEARCH_FIELDS) {
    assert.ok(fields.has(field), `missing idea field ${field}`);
  }
});

test("buildDocumentationWhere q searches title, category, path, content, source", () => {
  const where = buildDocumentationWhere({ q: "setup", category: "SETUP" }) as Record<string, unknown>;
  const fields = new Set(scalarFieldsInOr(where));
  for (const field of DOCUMENT_SEARCH_FIELDS) {
    assert.ok(fields.has(field), `missing documentation field ${field}`);
  }
});

test("buildInsightWhere q searches insight text fields", () => {
  const where = buildInsightWhere({ q: "langgraph" }) as Record<string, unknown>;
  const fields = new Set(scalarFieldsInOr(where));
  for (const field of INSIGHT_SEARCH_FIELDS) {
    assert.ok(fields.has(field), `missing insight field ${field}`);
  }
});

test("buildActivityWhere q searches type and title", () => {
  const where = buildActivityWhere({ q: "synced" }) as Record<string, unknown>;
  const fields = new Set(scalarFieldsInOr(where));
  for (const field of PROJECT_ACTIVITY_SEARCH_FIELDS) {
    assert.ok(fields.has(field), `missing activity field ${field}`);
  }
});
