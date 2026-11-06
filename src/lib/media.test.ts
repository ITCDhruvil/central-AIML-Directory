import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanMediaName, mediaMarkdownAlt, parseMediaAlt, safeMediaSrc, sniffMedia } from "@/lib/media";

const bytes = (...v: number[]) => {
  const b = new Uint8Array(16);
  v.forEach((x, i) => (b[i] = x));
  return b;
};
const text = (s: string, at = 0) => {
  const b = new Uint8Array(16);
  [...s].forEach((c, i) => (b[at + i] = c.charCodeAt(0)));
  return b;
};

test("sniffs media from the first bytes", () => {
  assert.equal(sniffMedia(bytes(0xff, 0xd8, 0xff))?.type, "image/jpeg");
  assert.equal(sniffMedia(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.type, "image/png");
  assert.equal(sniffMedia(text("OggS"))?.kind, "audio");
  assert.equal(sniffMedia(text("ID3"))?.type, "audio/mpeg");
  const mp4 = text("ftypisom", 4);
  assert.equal(sniffMedia(mp4)?.kind, "video");
  assert.equal(sniffMedia(mp4, "audio")?.kind, "audio");
  const wav = text("RIFF");
  "WAVE".split("").forEach((c, i) => (wav[8 + i] = c.charCodeAt(0)));
  assert.equal(sniffMedia(wav)?.type, "audio/wav");
});

test("refuses svg, html and unknown data", () => {
  assert.equal(sniffMedia(text("<svg xmlns=...")), null);
  assert.equal(sniffMedia(text("<!doctype html>")), null);
  assert.equal(sniffMedia(bytes(1, 2, 3)), null);
});

test("media markdown alt round-trips and sources are checked", () => {
  const alt = mediaMarkdownAlt("video", "my [demo].mp4");
  assert.deepEqual(parseMediaAlt(alt), { kind: "video", name: "my demo.mp4" });
  assert.equal(parseMediaAlt("a photo"), null);
  assert.equal(safeMediaSrc("/api/media/abc123"), "/api/media/abc123");
  assert.equal(safeMediaSrc("javascript:alert(1)"), null);
  assert.equal(safeMediaSrc("/api/media/../secret"), null);
  assert.equal(cleanMediaName("C:\\x\\clip<1>.mp4"), "clip1.mp4");
});
