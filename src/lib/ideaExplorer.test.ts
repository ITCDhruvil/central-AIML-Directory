import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_IDEA_SORT,
  filterIdeas,
  ideaMatchesQuery,
  ideaOwnerOptions,
  ideaSortToPreset,
  sortIdeas,
  toggleIdeaSort,
} from "@/lib/ideaExplorer";
import type { Idea } from "@/types/idea";

const idea = (over: Partial<Idea> & { name: string }): Idea => ({
  id: over.name,
  slug: over.name.toLowerCase(),
  description: null,
  status: "ACTIVE",
  owner: null,
  technologies: [],
  tags: [],
  promotedProjectId: null,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  ...over,
});

const tech = (name: string) => ({ name, category: "TOOL" }) as unknown as Idea["technologies"][number];

test("search finds an idea by name, description, owner, tag, technology and status", () => {
  const i = idea({ name: "Crop Health", description: "Satellite imagery", owner: "Devika", tags: ["agriculture"], technologies: [tech("Sentinel-2")], status: "ON_HOLD" });
  for (const q of ["crop", "satellite", "devika", "agri", "sentinel", "on hold"]) assert.equal(ideaMatchesQuery(i, q), true, q);
  assert.equal(ideaMatchesQuery(i, "blockchain"), false);
  assert.equal(ideaMatchesQuery(i, "   "), true);
});

test("filterIdeas combines text, status and owner", () => {
  const list = [
    idea({ name: "A", owner: "Devika", status: "ACTIVE" }),
    idea({ name: "B", owner: "Devika", status: "ARCHIVED" }),
    idea({ name: "C", owner: "Admin", status: "ACTIVE" }),
  ];
  assert.equal(filterIdeas(list, { query: "", statuses: [], owner: "" }).length, 3);
  assert.deepEqual(filterIdeas(list, { query: "", statuses: ["ACTIVE"], owner: "" }).map((i) => i.name), ["A", "C"]);
  assert.deepEqual(filterIdeas(list, { query: "", statuses: ["ACTIVE", "ARCHIVED"], owner: "devika" }).map((i) => i.name), ["A", "B"]);
  assert.deepEqual(filterIdeas(list, { query: "c", statuses: [], owner: "Admin" }).map((i) => i.name), ["C"]);
});

test("ideaOwnerOptions lists distinct names once, ignoring case, sorted", () => {
  const list = [idea({ name: "A", owner: "devika" }), idea({ name: "B", owner: "Devika" }), idea({ name: "C", owner: "Admin" }), idea({ name: "D", owner: null })];
  assert.deepEqual(ideaOwnerOptions(list), ["Admin", "devika"]);
});

test("sortIdeas: by name both ways, by date newest-first, owners blank last", () => {
  const list = [
    idea({ name: "Beta", updatedAt: "2026-09-02T00:00:00Z", owner: "Zed" }),
    idea({ name: "Alpha", updatedAt: "2026-09-03T00:00:00Z", owner: null }),
    idea({ name: "Gamma", updatedAt: "2026-09-01T00:00:00Z", owner: "Amy" }),
  ];
  assert.deepEqual(sortIdeas(list, { column: "name", dir: "asc" }).map((i) => i.name), ["Alpha", "Beta", "Gamma"]);
  assert.deepEqual(sortIdeas(list, { column: "name", dir: "desc" }).map((i) => i.name), ["Gamma", "Beta", "Alpha"]);
  assert.deepEqual(sortIdeas(list, DEFAULT_IDEA_SORT).map((i) => i.name), ["Alpha", "Beta", "Gamma"]);
  assert.deepEqual(sortIdeas(list, { column: "owner", dir: "asc" }).map((i) => i.name), ["Gamma", "Beta", "Alpha"]);
  assert.deepEqual(sortIdeas(list, { column: "owner", dir: "desc" }).map((i) => i.name), ["Beta", "Gamma", "Alpha"]);
});

test("sortIdeas does not change the list it was given", () => {
  const list = [idea({ name: "B" }), idea({ name: "A" })];
  sortIdeas(list, { column: "name", dir: "asc" });
  assert.deepEqual(list.map((i) => i.name), ["B", "A"]);
});

test("toggleIdeaSort: a new column starts ascending (dates newest first); the active one flips", () => {
  assert.deepEqual(toggleIdeaSort({ column: "updated", dir: "desc" }, "name"), { column: "name", dir: "asc" });
  assert.deepEqual(toggleIdeaSort({ column: "name", dir: "asc" }, "name"), { column: "name", dir: "desc" });
  assert.deepEqual(toggleIdeaSort({ column: "name", dir: "asc" }, "updated"), { column: "updated", dir: "desc" });
});

test("ideaSortToPreset maps a sort to its menu entry, or null for header-only sorts", () => {
  assert.equal(ideaSortToPreset({ column: "name", dir: "asc" }), "name-asc");
  assert.equal(ideaSortToPreset({ column: "status", dir: "asc" }), null);
});
