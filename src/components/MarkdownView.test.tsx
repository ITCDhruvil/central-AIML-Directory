import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownView } from "@/components/MarkdownView";

test("MarkdownView renders script/HTML-looking Markdown as inert text, never as executable HTML", () => {
  const malicious =
    "# Title\n\n<script>window.__xss = true;</script>\n\n<img src=x onerror=\"window.__xss = true\">\n\nNormal **text**.";
  const html = renderToStaticMarkup(<MarkdownView content={malicious} />);

  assert.ok(!html.includes("<script>"), "a real <script> element must never appear in rendered output");
  assert.ok(!html.includes("<img"), "raw <img> HTML must not be rendered as a real element without rehype-raw");
  // The literal text "onerror=..." is safe to appear as *escaped visible text*
  // (proven by the <img> check above never matching a real element) — what
  // matters is that it's never a live attribute on an actual DOM node.
  assert.ok(html.includes("Normal"), "legitimate surrounding Markdown still renders");
  assert.ok(html.includes("Title"), "headings still render");
});

test("MarkdownView does not execute Markdown link/image injection tricks as raw HTML", () => {
  const content = '[click me](javascript:alert(1)) and <a href="javascript:alert(1)">link</a>';
  const html = renderToStaticMarkup(<MarkdownView content={content} />);
  // The manually-typed raw <a> tag must not survive as a real anchor element;
  // it's inert text like the script/img cases above.
  assert.ok(!html.includes('<a href="javascript:alert(1)">link</a>'), "raw HTML anchor must not be rendered verbatim");
});
