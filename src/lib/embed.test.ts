import { test } from "node:test";
import assert from "node:assert/strict";
import { embedSource } from "@/lib/embed";
import { headingId, markdownHeadings, parseAlertMarker } from "@/lib/alerts";

test("builds frame addresses only for allowed providers", () => {
  assert.equal(embedSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.src, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(embedSource("https://youtu.be/dQw4w9WgXcQ")?.provider, "youtube");
  assert.equal(embedSource("https://vimeo.com/123456789")?.src, "https://player.vimeo.com/video/123456789");
  assert.equal(embedSource("https://www.loom.com/share/abc123def456")?.src, "https://www.loom.com/embed/abc123def456");
  assert.equal(embedSource("https://www.figma.com/design/AbC/File?node-id=1")?.provider, "figma");
});

test("refuses other hosts, schemes and malformed links", () => {
  assert.equal(embedSource("https://evil.test/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(embedSource("javascript:alert(1)"), null);
  assert.equal(embedSource("https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(embedSource("not a url"), null);
  assert.equal(embedSource("https://www.youtube.com/watch?v=short"), null);
});

test("reads callout and toggle markers", () => {
  assert.deepEqual(parseAlertMarker("[!WARNING]\nBack up first"), { kind: "callout", type: "warning", rest: "Back up first" });
  assert.deepEqual(parseAlertMarker("[!note] hello"), { kind: "callout", type: "info", rest: "hello" });
  assert.deepEqual(parseAlertMarker("[!TOGGLE]\nTitle"), { kind: "toggle", rest: "Title" });
  assert.equal(parseAlertMarker("just a quote"), null);
});

test("lists headings for a table of contents with unique ids", () => {
  const h = markdownHeadings("# One\n\n## Two\n\n```\n# not a heading\n```\n\n## Two\n\n#### too deep");
  assert.deepEqual(h.map((x) => [x.level, x.text, x.id]), [[1, "One", "one"], [2, "Two", "two"], [2, "Two", "two-1"]]);
  assert.equal(headingId("Hello, World!", new Map()), "hello-world");
});
