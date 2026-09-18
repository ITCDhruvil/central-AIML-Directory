import { test } from "node:test";
import assert from "node:assert/strict";
import { getPaginationPages } from "@/lib/paginationPages";

test("returns every page when there are 7 or fewer", () => {
  assert.deepEqual(getPaginationPages(1, 1), [1]);
  assert.deepEqual(getPaginationPages(3, 7), [1, 2, 3, 4, 5, 6, 7]);
});

test("keeps the first two, last two, and a window around the current page", () => {
  assert.deepEqual(getPaginationPages(1, 20), [1, 2, "ellipsis", 19, 20]);
  assert.deepEqual(getPaginationPages(10, 20), [1, 2, "ellipsis", 9, 10, 11, "ellipsis", 19, 20]);
  assert.deepEqual(getPaginationPages(20, 20), [1, 2, "ellipsis", 19, 20]);
});

test("never inserts an ellipsis for a one-page gap", () => {
  // page 3 of 8: window is 2,3,4 — touches the "first two" (1,2) with no gap before it
  assert.deepEqual(getPaginationPages(3, 8), [1, 2, 3, 4, "ellipsis", 7, 8]);
});

test("has no duplicate page numbers near the edges", () => {
  const pages = getPaginationPages(2, 20).filter((p) => p !== "ellipsis");
  assert.equal(new Set(pages).size, pages.length);
});
