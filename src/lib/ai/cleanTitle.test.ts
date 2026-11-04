import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanTitle } from "@/lib/ai/cleanTitle";

test("strips headings, labels, quotes, emphasis and trailing punctuation", () => {
  assert.equal(cleanTitle('# "Deployment Guide for UAT."'), "Deployment Guide for UAT");
  assert.equal(cleanTitle("Title: **API Access Rules**"), "API Access Rules");
  assert.equal(cleanTitle("`Setup Steps`:"), "Setup Steps");
});

test("uses only the first non-empty line", () => {
  assert.equal(cleanTitle("\n\nRelease Notes\nThis document explains..."), "Release Notes");
});

test("cuts an over-long title at a word boundary", () => {
  const title = cleanTitle("word ".repeat(40));
  assert.ok(title.length <= 80);
  assert.ok(!title.endsWith(" "));
});

test("returns an empty string for nothing usable", () => {
  assert.equal(cleanTitle("   \n  "), "");
});
