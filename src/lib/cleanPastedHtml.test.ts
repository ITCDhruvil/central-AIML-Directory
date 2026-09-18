import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanPastedHtml } from "@/lib/cleanPastedHtml";

test("strips MS Office conditional comments", () => {
  const html = "<!--[if gte mso 9]><xml>junk</xml><![endif]--><p>Hello</p>";
  assert.equal(cleanPastedHtml(html), "<p>Hello</p>");
});

test("strips generic HTML comments", () => {
  assert.equal(cleanPastedHtml("<p>a</p><!-- comment --><p>b</p>"), "<p>a</p><p>b</p>");
});

test("strips style/meta/xml blocks", () => {
  const html = "<style>.a{color:red}</style><meta charset='utf-8'><xml>junk</xml><p>Hi</p>";
  assert.equal(cleanPastedHtml(html), "<p>Hi</p>");
});

test("strips class, style, and lang attributes", () => {
  const html = '<p class="MsoNormal" style="margin:0" lang="EN-US">Text</p>';
  assert.equal(cleanPastedHtml(html), "<p>Text</p>");
});

test("unwraps span tags but keeps their content", () => {
  const html = '<p><span style="color:red">Hello</span> <span> </span>world</p>';
  assert.equal(cleanPastedHtml(html), "<p>Hello world</p>");
});

test("drops empty formatting tags", () => {
  assert.equal(cleanPastedHtml("<p><b></b>Hello<i></i></p>"), "<p>Hello</p>");
});
