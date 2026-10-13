import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generatePassword,
  passwordStrength,
  suggestUsername,
  validatePasswordStrength,
} from "@/lib/auth/passwordStrength";

test("required rules gate acceptance", () => {
  assert.equal(passwordStrength("").meetsRequirements, false);
  assert.equal(passwordStrength("short1").meetsRequirements, false);
  assert.equal(passwordStrength("allletters").meetsRequirements, false);
  assert.equal(passwordStrength("goodpass1").meetsRequirements, true);
});

test("labels climb with extra rules", () => {
  assert.equal(passwordStrength("goodpass1").label, "Weak");
  assert.equal(passwordStrength("Goodpass1").label, "Fair");
  assert.equal(passwordStrength("Goodpass1!").label, "Good");
  assert.equal(passwordStrength("Goodpass1!xyz").label, "Strong");
});

test("rules list reports each rule's state", () => {
  const rules = passwordStrength("Goodpass1").rules;
  const byId = Object.fromEntries(rules.map((r) => [r.id, r.met]));
  assert.deepEqual(byId, { length: true, mix: true, case: true, symbol: false, long: false });
});

test("generated passwords are strong, long and different", () => {
  const a = generatePassword();
  const b = generatePassword();
  assert.notEqual(a, b);
  assert.ok(a.length >= 14);
  assert.equal(passwordStrength(a).label, "Strong");
  assert.equal(validatePasswordStrength(a), null);
});

test("validatePasswordStrength keeps its messages", () => {
  assert.equal(validatePasswordStrength("short1"), "Password must be at least 8 characters.");
  assert.equal(validatePasswordStrength("12345678"), "Password must include a letter and a number.");
});

test("suggestUsername builds first.last@domain", () => {
  assert.equal(suggestUsername("Ada", "Lovelace", "itcube.net"), "ada.lovelace@itcube.net");
  assert.equal(suggestUsername(" Mary Ann ", "O'Neil", "itcube.net"), "maryann.oneil@itcube.net");
  assert.equal(suggestUsername("Ada", "", "itcube.net"), "ada@itcube.net");
  assert.equal(suggestUsername("", "", "itcube.net"), "");
  assert.equal(suggestUsername("José", "Núñez", "itcube.net"), "jose.nunez@itcube.net");
});

test("policy: a longer minimum changes the length rule and message", () => {
  const policy = { passwordMinLength: 12, requireSymbol: false, requireMixedCase: false };
  assert.equal(passwordStrength("goodpass1", policy).meetsRequirements, false);
  assert.equal(passwordStrength("goodpass1234", policy).meetsRequirements, true);
  assert.equal(passwordStrength("goodpass1", policy).rules[0].label, "At least 12 characters");
  assert.equal(validatePasswordStrength("goodpass1", policy), "Password must be at least 12 characters.");
});

test("policy: required symbol and mixed case gate acceptance", () => {
  const policy = { passwordMinLength: 8, requireSymbol: true, requireMixedCase: true };
  assert.equal(passwordStrength("goodpass1", policy).meetsRequirements, false);
  assert.equal(validatePasswordStrength("goodpass1", policy), "Password must include upper and lower case letters.");
  assert.equal(validatePasswordStrength("Goodpass1", policy), "Password must include a symbol.");
  assert.equal(validatePasswordStrength("Goodpass1!", policy), null);
  const byId = Object.fromEntries(passwordStrength("goodpass1", policy).rules.map((r) => [r.id, r.required]));
  assert.equal(byId.symbol, true);
  assert.equal(byId.case, true);
});

test("policy: strength rating does not drop just because extras became required", () => {
  const strict = { passwordMinLength: 8, requireSymbol: true, requireMixedCase: true };
  assert.equal(passwordStrength("Goodpass1!xyz", strict).label, "Strong");
});

test("policy: the 12-character hint disappears when the minimum already covers it", () => {
  const policy = { passwordMinLength: 14, requireSymbol: false, requireMixedCase: false };
  assert.equal(passwordStrength("goodpass1234567", policy).rules.some((r) => r.id === "long"), false);
});
