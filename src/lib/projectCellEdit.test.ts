import { test } from "node:test";
import assert from "node:assert/strict";
import { EDITABLE_WHEN_EMPTY, buildCellPatch } from "@/lib/projectCellEdit";

test("only fields that can be empty are editable from the table", () => {
  assert.deepEqual([...EDITABLE_WHEN_EMPTY].sort(), ["branch", "deployment", "github", "owner", "stage", "tags", "technologies"]);
});

test("owner and branch trim and reject blanks", () => {
  assert.deepEqual(buildCellPatch("owner", "  Ada Lovelace "), { ok: true, patch: { owner: "Ada Lovelace" } });
  assert.equal(buildCellPatch("owner", "   ").ok, false);
  assert.deepEqual(buildCellPatch("branch", "main"), { ok: true, patch: { defaultBranch: "main" } });
  assert.equal(buildCellPatch("branch", "bad branch!").ok, false);
});

test("stage must be a known stage", () => {
  assert.deepEqual(buildCellPatch("stage", "PRODUCTION"), { ok: true, patch: { stage: "PRODUCTION" } });
  assert.equal(buildCellPatch("stage", "SOMEDAY").ok, false);
});

test("github accepts a repo URL and fills owner and repo", () => {
  const r = buildCellPatch("github", "https://github.com/acme/widgets/");
  assert.deepEqual(r, {
    ok: true,
    patch: { githubUrl: "https://github.com/acme/widgets", githubOwner: "acme", githubRepo: "widgets" },
  });
  const bad = buildCellPatch("github", "https://github.com/acme");
  assert.equal(bad.ok, false);
  assert.match(bad.ok ? "" : bad.error, /github\.com\/owner\/repo/);
});

test("deployment must be an http(s) URL", () => {
  assert.deepEqual(buildCellPatch("deployment", "https://app.example.com"), {
    ok: true,
    patch: { deploymentUrls: ["https://app.example.com"] },
  });
  assert.equal(buildCellPatch("deployment", "not a url").ok, false);
  assert.equal(buildCellPatch("deployment", "ftp://x.com").ok, false);
});

test("technologies and tags take lists, trimmed and de-duplicated", () => {
  const t = buildCellPatch("technologies", [" React ", "react", "Python", ""]);
  assert.equal(t.ok, true);
  if (t.ok) {
    const techs = t.patch.technologies as { name: string; category: string }[];
    assert.deepEqual(techs.map((x) => x.name), ["React", "Python"]);
    assert.equal(techs[0].category, "OTHER");
  }
  assert.deepEqual(buildCellPatch("tags", ["a", "A", " b "]), { ok: true, patch: { tags: ["a", "b"] } });
  assert.equal(buildCellPatch("tags", []).ok, false);
  assert.equal(buildCellPatch("technologies", [" "]).ok, false);
});
