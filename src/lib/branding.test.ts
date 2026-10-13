import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_BRANDING, documentTitle, parseBranding, sanitizeBranding } from "@/lib/branding";

test("accepts a valid name and tagline and tidies whitespace", () => {
  const r = sanitizeBranding({ appName: "  Acme   Labs ", tagline: " Project  Hub " });
  assert.ok(r.ok);
  assert.deepEqual(r.branding, { appName: "Acme Labs", tagline: "Project Hub" });
});

test("an empty tagline is allowed, an empty name is not", () => {
  assert.equal(sanitizeBranding({ appName: "Acme", tagline: "" }).ok, true);
  assert.equal(sanitizeBranding({ appName: "   ", tagline: "x" }).ok, false);
});

test("length limits apply", () => {
  assert.equal(sanitizeBranding({ appName: "x".repeat(41), tagline: "" }).ok, false);
  assert.equal(sanitizeBranding({ appName: "x".repeat(40), tagline: "y".repeat(61) }).ok, false);
});

test("markup and control characters are refused", () => {
  assert.equal(sanitizeBranding({ appName: "<script>", tagline: "" }).ok, false);
  assert.equal(sanitizeBranding({ appName: "Acme", tagline: "a\u0000b" }).ok, false);
});

test("non-objects are refused", () => {
  assert.equal(sanitizeBranding(null).ok, false);
  assert.equal(sanitizeBranding("Acme").ok, false);
});

test("parseBranding falls back to the defaults on bad storage", () => {
  assert.deepEqual(parseBranding(null), DEFAULT_BRANDING);
  assert.deepEqual(parseBranding("garbage"), DEFAULT_BRANDING);
  assert.deepEqual(parseBranding(JSON.stringify({ appName: "" })), DEFAULT_BRANDING);
  assert.equal(parseBranding(JSON.stringify({ appName: "Acme", tagline: "Hub" })).appName, "Acme");
});

test("documentTitle joins name and tagline", () => {
  assert.equal(documentTitle({ appName: "Acme", tagline: "Hub" }), "Acme Hub");
  assert.equal(documentTitle({ appName: "Acme", tagline: "" }), "Acme");
});
