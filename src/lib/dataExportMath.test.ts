import assert from "node:assert/strict";
import test from "node:test";
import { exportFilename, listToCell, parseList } from "@/lib/dataExportMath";

test("parseList reads a JSON string array and ignores everything else", () => {
  assert.deepEqual(parseList('["a","b"]'), ["a", "b"]);
  assert.deepEqual(parseList('["a",1,null,"b"]'), ["a", "b"]);
  assert.deepEqual(parseList('{"a":1}'), []);
  assert.deepEqual(parseList("not json"), []);
  assert.deepEqual(parseList(null), []);
  assert.deepEqual(parseList(""), []);
});

test("listToCell joins with semicolons so commas stay free for CSV", () => {
  assert.equal(listToCell('["Python","FastAPI"]'), "Python; FastAPI");
  assert.equal(listToCell("[]"), "");
});

test("exportFilename is dated and safe", () => {
  const d = new Date("2026-10-13T08:00:00Z");
  assert.equal(exportFilename("projects", "csv", d), "projects-2026-10-13.csv");
  assert.equal(exportFilename("My Backup!", "json", d), "my-backup-2026-10-13.json");
  assert.equal(exportFilename("???", "csv", d), "export-2026-10-13.csv");
});
