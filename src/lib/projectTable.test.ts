import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_COLUMNS,
  availableColumns,
  columnDataCount,
  normalizeColumns,
  presetToSort,
  sortProjectsBy,
  sortToPreset,
  matchesOwnerFilter,
  ownerOptions,
} from "@/lib/projectTable";
import type { Project } from "@/types/project";

function project(partial: Partial<Project> & { id: string }): Project {
  return {
    name: partial.id,
    slug: partial.id,
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
    ...partial,
  };
}

test("normalizeColumns keeps valid ids in order, drops unknown/duplicates, and always leads with name", () => {
  assert.deepEqual(normalizeColumns(["status", "bogus", "type", "status"]), ["name", "status", "type"]);
  assert.deepEqual(normalizeColumns(["type", "name", "owner"]), ["name", "type", "owner"]);
  assert.deepEqual(normalizeColumns(null), DEFAULT_COLUMNS);
  assert.deepEqual(normalizeColumns("nope"), DEFAULT_COLUMNS);
  assert.deepEqual(normalizeColumns([]), ["name"]);
});

test("availableColumns lists the catalog minus what is shown", () => {
  const shown = ["name", "type"] as const;
  const rest = availableColumns([...shown]);
  assert.ok(rest.includes("status") && rest.includes("owner") && rest.includes("updated"));
  assert.ok(!rest.includes("name") && !rest.includes("type"));
});

test("columnDataCount counts projects that actually have a value", () => {
  const data = [project({ id: "a", owner: "Ada" }), project({ id: "b" }), project({ id: "c", owner: "Bob", tags: ["x"] })];
  assert.equal(columnDataCount(data, "owner"), 2);
  assert.equal(columnDataCount(data, "tags"), 1);
  assert.equal(columnDataCount(data, "github"), 0);
  assert.equal(columnDataCount(data, "name"), 3);
});

test("sortProjectsBy sorts by column and direction, with empty values last", () => {
  const data = [
    project({ id: "b", name: "beta", owner: "Zed", updatedAt: "2026-03-01T00:00:00.000Z" }),
    project({ id: "a", name: "Alpha", owner: null, updatedAt: "2026-05-01T00:00:00.000Z" }),
    project({ id: "c", name: "charlie", owner: "Amy", updatedAt: "2026-04-01T00:00:00.000Z" }),
  ];
  assert.deepEqual(sortProjectsBy(data, { column: "name", dir: "asc" }).map((p) => p.id), ["a", "b", "c"]);
  assert.deepEqual(sortProjectsBy(data, { column: "updated", dir: "desc" }).map((p) => p.id), ["a", "c", "b"]);
  assert.deepEqual(sortProjectsBy(data, { column: "owner", dir: "asc" }).map((p) => p.id), ["c", "b", "a"]);
  assert.deepEqual(sortProjectsBy(data, { column: "owner", dir: "desc" }).map((p) => p.id), ["b", "c", "a"]);
});

test("technology count and status sort", () => {
  const tech = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `t${i}`, category: "OTHER" as const, evidence: [], confidence: "HIGH" as const }));
  const data = [project({ id: "x", technologies: tech(1) }), project({ id: "y", technologies: tech(3) })];
  assert.deepEqual(sortProjectsBy(data, { column: "technologies", dir: "desc" }).map((p) => p.id), ["y", "x"]);
});

test("presets map to and from sort state", () => {
  assert.deepEqual(presetToSort("updated-desc"), { column: "updated", dir: "desc" });
  assert.equal(sortToPreset({ column: "name", dir: "asc" }), "name-asc");
  assert.equal(sortToPreset({ column: "owner", dir: "asc" }), null);
});

test("owner filter: mine, all, or one named person (case-insensitive)", () => {
  const mine = ["Devika S Vinod"];
  const p = project({ id: "a", owner: "devika s vinod" });
  assert.equal(matchesOwnerFilter(p, "me", mine), true);
  assert.equal(matchesOwnerFilter(p, "", mine), true);
  assert.equal(matchesOwnerFilter(p, "Devika S Vinod", mine), true);
  assert.equal(matchesOwnerFilter(p, "Arun", mine), false);
  assert.equal(matchesOwnerFilter(project({ id: "b" }), "me", mine), false);
  assert.equal(matchesOwnerFilter(project({ id: "b" }), "me", []), false);
});

test("ownerOptions are distinct, sorted, and ignore blanks", () => {
  const data = [project({ id: "1", owner: "Zoe" }), project({ id: "2", owner: "amy" }), project({ id: "3", owner: "Zoe" }), project({ id: "4" })];
  assert.deepEqual(ownerOptions(data), ["amy", "Zoe"]);
});

test("team membership counts for 'mine' and for a named person", () => {
  const withTeam = project({
    id: "t",
    owner: "Someone Else",
    team: [
      { userId: "u1", name: "Devika S Vinod", role: "OWNER" },
      { userId: "u2", name: "Arun K", role: "EDIT" },
    ],
  });
  assert.equal(matchesOwnerFilter(withTeam, "me", [], "u2"), true);
  assert.equal(matchesOwnerFilter(withTeam, "me", [], "u9"), false);
  assert.equal(matchesOwnerFilter(withTeam, "devika s vinod", []), true);
  assert.equal(matchesOwnerFilter(withTeam, "Someone Else", []), true);
  assert.equal(matchesOwnerFilter(withTeam, "Nobody", []), false);
});

test("ownerOptions include team members and owner sorts by the lead", () => {
  const data = [
    project({ id: "a", owner: "Zed", team: [{ userId: "u1", name: "Amy", role: "OWNER" }] }),
    project({ id: "b", owner: "Bob" }),
  ];
  assert.deepEqual(ownerOptions(data), ["Amy", "Bob", "Zed"]);
  assert.deepEqual(sortProjectsBy(data, { column: "owner", dir: "asc" }).map((p) => p.id), ["a", "b"]);
});
