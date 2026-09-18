import { test } from "node:test";
import assert from "node:assert/strict";
import { stripMarkdown } from "@/lib/stripMarkdown";

test("strips headings", () => {
  assert.equal(stripMarkdown("## Overview\nSome text"), "Overview Some text");
});

test("strips bold and italic", () => {
  assert.equal(stripMarkdown("**Fast** and *simple* framework"), "Fast and simple framework");
});

test("strips inline code and fenced code blocks", () => {
  assert.equal(stripMarkdown("Run `npm test` then\n```\nnpm build\n```\ndone"), "Run npm test then done");
});

test("strips links, keeping the label", () => {
  assert.equal(stripMarkdown("See [the docs](https://example.com) for more"), "See the docs for more");
});

test("strips list markers", () => {
  assert.equal(stripMarkdown("- one\n- two\n1. three"), "one two three");
});

test("strips blockquotes and strikethrough", () => {
  assert.equal(stripMarkdown("> quoted text\n~~old~~ new"), "quoted text old new");
});

test("collapses whitespace and trims", () => {
  assert.equal(stripMarkdown("  Hello   world  \n\n  again  "), "Hello world again");
});

test("plain text with no markdown passes through unchanged (aside from trimming)", () => {
  assert.equal(stripMarkdown("Just a normal sentence."), "Just a normal sentence.");
});
