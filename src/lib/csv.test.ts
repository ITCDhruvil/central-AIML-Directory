import assert from "node:assert/strict";
import test from "node:test";
import { csvCell, toCsv } from "@/lib/csv";

test("plain values are left alone", () => {
  assert.equal(csvCell("hello"), "hello");
  assert.equal(csvCell(42), "42");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(undefined), "");
});

test("commas, quotes and line breaks are quoted and escaped", () => {
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
});

test("spreadsheet formulas are neutralised", () => {
  assert.equal(csvCell("=SUM(A1:A9)"), "'=SUM(A1:A9)");
  assert.equal(csvCell("+1"), "'+1");
  assert.equal(csvCell("@cmd"), "'@cmd");
  assert.equal(csvCell("-5"), "'-5");
});

test("toCsv joins rows with CRLF and ends with one", () => {
  assert.equal(toCsv(["a", "b"], [[1, "x,y"]]), 'a,b\r\n1,"x,y"\r\n');
});
