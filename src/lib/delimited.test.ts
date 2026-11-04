import { test } from "node:test";
import assert from "node:assert/strict";
import { detectDelimiter, parseDelimited } from "@/lib/delimited";
import { fileKindOf, previewKindFor } from "@/lib/fileKind";

test("parses quoted cells, escaped quotes and line breaks inside quotes", () => {
  const rows = parseDelimited('a,"b, c","say ""hi"""\n1,"two\nlines",3\n', ",");
  assert.deepEqual(rows, [
    ["a", "b, c", 'say "hi"'],
    ["1", "two\nlines", "3"],
  ]);
});

test("handles CRLF, a missing final newline and a BOM", () => {
  assert.deepEqual(parseDelimited("﻿a,b\r\nc,d", ","), [
    ["a", "b"],
    ["c", "d"],
  ]);
});

test("detects semicolon and tab delimiters", () => {
  assert.equal(detectDelimiter("a;b;c\n1;2;3", "csv"), ";");
  assert.equal(detectDelimiter("a,b,c", "csv"), ",");
  assert.equal(detectDelimiter("a\tb", "tsv"), "\t");
});

test("classifies files and picks a preview", () => {
  assert.equal(fileKindOf("xlsx"), "spreadsheet");
  assert.equal(fileKindOf("bin", "image/png"), "image");
  assert.equal(fileKindOf("weird"), "other");
  assert.equal(previewKindFor("XLSX"), "sheets");
  assert.equal(previewKindFor("md"), "markdown");
  assert.equal(previewKindFor("docx"), "docx");
  assert.equal(previewKindFor("xls"), null);
  assert.equal(previewKindFor("pdf"), null);
});
