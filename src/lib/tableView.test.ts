import assert from "node:assert/strict";
import test from "node:test";
import { matchesText, paginate, textOf } from "@/lib/tableView";

test("textOf joins strings, numbers and nested children, ignoring blanks", () => {
  const cell = { props: { children: ["Spec-Check-RAG", { props: { children: "link text" } }, 3, null, false] } };
  assert.equal(textOf(cell), "Spec-Check-RAG link text 3");
  assert.equal(textOf("plain"), "plain");
  assert.equal(textOf(undefined), "");
  assert.equal(textOf([{ props: { children: "a" } }, { props: { children: "b" } }]), "a b");
});

test("matchesText is a case-insensitive contains, and empty matches all", () => {
  assert.equal(matchesText("Devika S Vinod", "devika"), true);
  assert.equal(matchesText("Devika S Vinod", "  VINOD "), true);
  assert.equal(matchesText("Devika S Vinod", "admin"), false);
  assert.equal(matchesText("anything", ""), true);
  assert.equal(matchesText("anything", "   "), true);
});

test("paginate slices pages and reports the page count", () => {
  const items = Array.from({ length: 12 }, (_, i) => i + 1);
  assert.deepEqual(paginate(items, 1, 5), { items: [1, 2, 3, 4, 5], page: 1, totalPages: 3 });
  assert.deepEqual(paginate(items, 3, 5), { items: [11, 12], page: 3, totalPages: 3 });
});

test("paginate pulls an out-of-range page back, and copes with an empty list", () => {
  assert.equal(paginate([1, 2, 3], 9, 5).page, 1);
  assert.equal(paginate([1, 2, 3], 0, 5).page, 1);
  assert.equal(paginate([1, 2, 3], Number.NaN, 5).page, 1);
  assert.deepEqual(paginate([], 1, 5), { items: [], page: 1, totalPages: 1 });
});
