import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_EMAIL_DOMAIN, emailMatchesDomain, normalizeEmailDomain, usernameToEmail } from "@/lib/emailDomain";

test("default domain is itcube.net", () => {
  assert.equal(DEFAULT_EMAIL_DOMAIN, "itcube.net");
});

test("normalizeEmailDomain strips @ and whitespace, lowercases, and rejects junk", () => {
  assert.equal(normalizeEmailDomain("  @ITCube.net "), "itcube.net");
  assert.equal(normalizeEmailDomain("example.co.uk"), "example.co.uk");
  assert.equal(normalizeEmailDomain("nodot"), null);
  assert.equal(normalizeEmailDomain("bad domain.com"), null);
  assert.equal(normalizeEmailDomain("-bad.com"), null);
  assert.equal(normalizeEmailDomain(""), null);
  assert.equal(normalizeEmailDomain(undefined), null);
});

test("a username gets the domain appended", () => {
  assert.deepEqual(usernameToEmail("devika.svinod", "itcube.net"), { ok: true, email: "devika.svinod@itcube.net" });
  assert.deepEqual(usernameToEmail("  Devika.SVinod ", "itcube.net"), { ok: true, email: "devika.svinod@itcube.net" });
});

test("a full address is accepted only when it already uses the domain", () => {
  assert.deepEqual(usernameToEmail("ada@itcube.net", "itcube.net"), { ok: true, email: "ada@itcube.net" });
  assert.deepEqual(usernameToEmail("ADA@ITCUBE.NET", "itcube.net"), { ok: true, email: "ada@itcube.net" });
  const other = usernameToEmail("ada@gmail.com", "itcube.net");
  assert.equal(other.ok, false);
  assert.match(other.ok ? "" : other.error, /itcube\.net/);
});

test("empty or malformed usernames are rejected", () => {
  assert.equal(usernameToEmail("", "itcube.net").ok, false);
  assert.equal(usernameToEmail("   ", "itcube.net").ok, false);
  assert.equal(usernameToEmail("two words", "itcube.net").ok, false);
  assert.equal(usernameToEmail("@itcube.net", "itcube.net").ok, false);
});

test("emailMatchesDomain compares the part after @, case-insensitively", () => {
  assert.equal(emailMatchesDomain("a@itcube.net", "itcube.net"), true);
  assert.equal(emailMatchesDomain("A@ITCUBE.NET", "itcube.net"), true);
  assert.equal(emailMatchesDomain("a@sub.itcube.net", "itcube.net"), false);
  assert.equal(emailMatchesDomain("a@itcube.net.evil.com", "itcube.net"), false);
  assert.equal(emailMatchesDomain("noatsign", "itcube.net"), false);
});
