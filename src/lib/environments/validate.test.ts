import { test } from "node:test";
import assert from "node:assert/strict";
import { isBlockedHealthHost } from "@/lib/environments/healthCheck";
import {
  EnvironmentError,
  assertCanHoldCredentials,
  validateCredential,
  validateEnvironment,
  validateLink,
  validateReorder,
} from "@/lib/environments/validate";
import { decryptToken, encryptToken } from "@/lib/github/tokenCrypto";

test("environment needs a name on create but not on update", () => {
  assert.throws(() => validateEnvironment({}, true), EnvironmentError);
  assert.deepEqual(validateEnvironment({ hosting: "Azure" }, false), { hosting: "Azure" });
});

test("urls must be http or https", () => {
  assert.equal(validateEnvironment({ name: "UAT", appUrl: "https://a.example.com" }, true).appUrl, "https://a.example.com");
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://x.com", "not a url"]) {
    assert.throws(() => validateEnvironment({ name: "UAT", appUrl: bad }, true), EnvironmentError);
    assert.throws(() => validateLink({ label: "x", url: bad }, true), EnvironmentError);
  }
  assert.equal(validateEnvironment({ name: "UAT", appUrl: "  " }, true).appUrl, null);
});

test("unknown status and non-boolean production flag are rejected", () => {
  assert.throws(() => validateEnvironment({ name: "UAT", status: "HAPPY" }, true), EnvironmentError);
  assert.throws(() => validateEnvironment({ name: "UAT", isProduction: "yes" }, true), EnvironmentError);
});

test("credential requires purpose and username; password semantics", () => {
  assert.throws(() => validateCredential({ purpose: "admin" }, true), EnvironmentError);
  assert.equal(validateCredential({ purpose: "a", username: "u", password: " p w " }, true).password, " p w ");
  assert.equal(validateCredential({ password: "" }, false).password, null);
  assert.equal("password" in validateCredential({ notes: "n" }, false), false);
});

test("a Production environment cannot hold credentials", () => {
  assert.throws(() => assertCanHoldCredentials({ name: "PROD", isProduction: true }), (e) => e instanceof EnvironmentError && e.status === 403);
  assert.doesNotThrow(() => assertCanHoldCredentials({ name: "UAT", isProduction: false }));
});

test("reorder needs unique string ids", () => {
  assert.deepEqual(validateReorder({ ids: ["a", "b"] }), ["a", "b"]);
  assert.throws(() => validateReorder({ ids: ["a", "a"] }), EnvironmentError);
  assert.throws(() => validateReorder({ ids: "a" }), EnvironmentError);
});

test("health check refuses loopback and metadata hosts", () => {
  for (const h of ["localhost", "127.0.0.1", "169.254.169.254", "[::1]", "0.0.0.0", "a.localhost", "metadata.google.internal"]) {
    assert.equal(isBlockedHealthHost(h), true, h);
  }
  assert.equal(isBlockedHealthHost("space3-uat-chatbot.azurewebsites.net"), false);
});

test("credential encryption is separated from the GitHub token key", () => {
  const secret = "test-secret-test-secret-test-secret-123";
  const stored = encryptToken("hunter2", secret, "environment-credential-encryption");
  assert.equal(decryptToken(stored, secret, "environment-credential-encryption"), "hunter2");
  assert.equal(decryptToken(stored, secret), null);
});
