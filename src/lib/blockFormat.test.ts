import { test } from "node:test";
import assert from "node:assert/strict";
import { blockStyle, openTag, parseOpenTag } from "@/lib/blockFormat";

test("writes and reads back a block format", () => {
  const tag = openTag({ align: "center", dir: "rtl", lineHeight: "1.5", indent: 2 });
  assert.equal(tag, '<div align="center" dir="rtl" data-ls="1.5" data-ind="2">');
  assert.deepEqual(parseOpenTag(tag!), { align: "center", dir: "rtl", lineHeight: "1.5", indent: 2 });
  assert.equal(blockStyle({ align: "right", lineHeight: "2", indent: 3 }), "text-align:right;line-height:2;margin-inline-start:6rem");
});

test("the default format needs no wrapper", () => {
  assert.equal(openTag({}), null);
  assert.equal(openTag({ indent: 0 }), null);
});

test("refuses tags it did not write", () => {
  assert.equal(parseOpenTag('<div align="center" onclick="x()">'), null);
  assert.equal(parseOpenTag('<div data-ls="3">'), null);
  assert.equal(parseOpenTag('<div style="color:red">'), null);
  assert.equal(parseOpenTag("<div>"), null);
});
