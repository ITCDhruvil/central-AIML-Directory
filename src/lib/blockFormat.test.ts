import { test } from "node:test";
import assert from "node:assert/strict";
import { blockStyle, listOpenTag, openTag, parseListTag, parseOpenTag } from "@/lib/blockFormat";

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

test("title and subtitle variants ride in the same wrapper", () => {
  const tag = openTag({ variant: "title", align: "center" });
  assert.equal(tag, '<div align="center" data-pv="title">');
  assert.deepEqual(parseOpenTag(tag!), { align: "center", variant: "title" });
  assert.match(blockStyle({ variant: "subtitle" }), /font-size:1.25rem/);
});

test("list styles use their own wrapper", () => {
  assert.equal(listOpenTag("roman"), '<div data-lt="roman">');
  assert.equal(parseListTag('<div data-lt="ROMAN">'), "ROMAN");
  assert.equal(parseListTag('<div data-lt="evil">'), null);
  assert.equal(parseOpenTag('<div data-lt="alpha">'), null);
});
