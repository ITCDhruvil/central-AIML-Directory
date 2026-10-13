import assert from "node:assert/strict";
import test from "node:test";
import { MAX_AVATAR_BYTES, avatarUrl, sniffAvatarType, validateAvatar } from "@/lib/avatar";

const pad = (head: number[], total = 32) => Uint8Array.from([...head, ...new Array(total - head.length).fill(0)]);
const JPEG = pad([0xff, 0xd8, 0xff, 0xe0]);
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = pad([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);

test("sniffAvatarType recognises JPEG, PNG and WebP by their bytes", () => {
  assert.equal(sniffAvatarType(JPEG), "image/jpeg");
  assert.equal(sniffAvatarType(PNG), "image/png");
  assert.equal(sniffAvatarType(WEBP), "image/webp");
});

test("sniffAvatarType refuses everything else, however it is named", () => {
  const text = (s: string) => new TextEncoder().encode(s.padEnd(32, " "));
  assert.equal(sniffAvatarType(text("<svg xmlns='http://www.w3.org/2000/svg'></svg>")), null);
  assert.equal(sniffAvatarType(text("<html><script>alert(1)</script></html>")), null);
  assert.equal(sniffAvatarType(pad([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])), null); // GIF
  assert.equal(sniffAvatarType(new Uint8Array(4)), null);
  // RIFF but not WebP (e.g. a WAV file)
  assert.equal(sniffAvatarType(pad([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45])), null);
});

test("validateAvatar accepts a real picture and returns its verified type", () => {
  assert.deepEqual(validateAvatar(PNG), { ok: true, type: "image/png" });
});

test("validateAvatar rejects empty, oversized and wrong-type uploads with a readable message", () => {
  assert.equal(validateAvatar(new Uint8Array(0)).ok, false);
  const big = new Uint8Array(MAX_AVATAR_BYTES + 1);
  big.set(JPEG);
  const tooBig = validateAvatar(big);
  assert.equal(tooBig.ok, false);
  assert.match(!tooBig.ok ? tooBig.error : "", /too large/);
  const wrong = validateAvatar(new TextEncoder().encode("hello world, not an image at all"));
  assert.equal(wrong.ok, false);
  assert.match(!wrong.ok ? wrong.error : "", /JPEG, PNG or WebP/);
});

test("avatarUrl carries the version so a new picture busts the cache, and is null without a picture", () => {
  assert.equal(avatarUrl("u1", 1700000000000), "/api/users/u1/avatar?v=1700000000000");
  assert.equal(avatarUrl("u1", null), null);
  assert.equal(avatarUrl("u1", undefined), null);
  assert.equal(avatarUrl("a/b", 5), "/api/users/a%2Fb/avatar?v=5");
});
