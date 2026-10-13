import assert from "node:assert/strict";
import test from "node:test";
import { isSelf } from "@/lib/ai/selfMatch";

const me = { name: "Devika S Vinod", email: "devika.svinod@itcube.net" };

test("matches the full name, a first name and the email, ignoring case and spacing", () => {
  assert.equal(isSelf("Devika S Vinod", me), true);
  assert.equal(isSelf("  devika s vinod ", me), true);
  assert.equal(isSelf("Devika", me), true);
  assert.equal(isSelf("DEVIKA.SVINOD@ITCUBE.NET", me), true);
});

test("does not match someone else, a partial word, or nothing", () => {
  assert.equal(isSelf("Dev", me), false);
  assert.equal(isSelf("Vinod", me), false);
  assert.equal(isSelf("Admin", me), false);
  assert.equal(isSelf("", me), false);
  assert.equal(isSelf("   ", me), false);
});
