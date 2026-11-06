import { test } from "node:test";
import assert from "node:assert/strict";
import { buildImageSrc, parseImageSrc } from "@/lib/imageSrc";

test("round-trips size, alignment and crop through the link fragment", () => {
  const src = buildImageSrc("/api/media/abc", { w: 320, a: "c", c: { x: 0.1, y: 0.2, w: 0.5, h: 0.6 } });
  assert.equal(src, "/api/media/abc#w=320&a=c&c=0.1,0.2,0.5,0.6");
  assert.deepEqual(parseImageSrc(src), { base: "/api/media/abc", opts: { w: 320, a: "c", c: { x: 0.1, y: 0.2, w: 0.5, h: 0.6 } } });
});

test("plain links and default options stay untouched", () => {
  assert.equal(buildImageSrc("https://x.test/a.png", {}), "https://x.test/a.png");
  assert.equal(buildImageSrc("/api/media/abc", { a: "l" }), "/api/media/abc");
  assert.deepEqual(parseImageSrc("https://x.test/a.png"), { base: "https://x.test/a.png", opts: {} });
});

test("ignores out-of-range or malformed options", () => {
  assert.deepEqual(parseImageSrc("/a#w=5&a=z&c=0.5,0.5,0.9,0.9").opts, {});
  assert.deepEqual(parseImageSrc("/a#w=99999").opts, {});
});
