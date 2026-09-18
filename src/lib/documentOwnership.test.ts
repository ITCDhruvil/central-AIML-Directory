import { test } from "node:test";
import assert from "node:assert/strict";
import { documentSourceLabel, isDeletableDocument, isEditableDocument } from "@/lib/documentOwnership";

test("only manual documents are editable", () => {
  assert.equal(isEditableDocument("manual"), true);
  assert.equal(isEditableDocument("github"), false);
  assert.equal(isEditableDocument("generated"), false);
});

test("only manual documents are deletable", () => {
  assert.equal(isDeletableDocument("manual"), true);
  assert.equal(isDeletableDocument("github"), false);
  assert.equal(isDeletableDocument("generated"), false);
});

test("documentSourceLabel returns human-friendly labels, never the raw source string", () => {
  assert.equal(documentSourceLabel("github"), "GitHub");
  assert.equal(documentSourceLabel("generated"), "Generated");
  assert.equal(documentSourceLabel("manual"), "Manual");
});

test("documentSourceLabel falls back gracefully for an unknown source", () => {
  assert.equal(documentSourceLabel("something-else"), "something-else");
});
