import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareUpload } from "@/lib/uploadDocument";
import { MAX_MANUAL_DOCUMENT_CONTENT_LENGTH } from "@/types/documentation";

test("title comes from the file name and unknown names become Notes", () => {
  assert.deepEqual(prepareUpload("meeting-notes.md", "# Hi"), {
    title: "Meeting Notes",
    category: "NOTES",
    content: "# Hi",
  });
});

test("well-known names keep their category, but README is manual-safe", () => {
  const prd = prepareUpload("PRD.md", "text");
  assert.ok("category" in prd && prd.category === "PRD");
  const readme = prepareUpload("README.md", "text");
  assert.ok("category" in readme && readme.category === "NOTES");
});

test("strips a byte-order mark", () => {
  const result = prepareUpload("a.txt", "﻿hello");
  assert.ok("content" in result && result.content === "hello");
});

test("rejects unsupported, empty and oversized files", () => {
  assert.ok("error" in prepareUpload("image.png", "x"));
  assert.ok("error" in prepareUpload("a.md", "   \n"));
  assert.ok("error" in prepareUpload("big.md", "x".repeat(MAX_MANUAL_DOCUMENT_CONTENT_LENGTH + 1)));
});
