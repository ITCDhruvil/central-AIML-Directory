import { test } from "node:test";
import assert from "node:assert/strict";
import { isManualFilePath, MANUAL_PATH_PREFIX, slugifyDocumentTitle } from "@/lib/manualDocuments";

test("slugifyDocumentTitle produces a URL-safe lowercase slug", () => {
  assert.equal(slugifyDocumentTitle("Production Deployment Notes"), "production-deployment-notes");
  assert.equal(slugifyDocumentTitle("  Weird!! Title??  "), "weird-title");
  assert.equal(slugifyDocumentTitle(""), "document");
});

test("isManualFilePath recognizes the manual namespace and rejects GitHub-style paths", () => {
  assert.equal(isManualFilePath(`${MANUAL_PATH_PREFIX}/project-notes.md`), true);
  assert.equal(isManualFilePath("docs/ARCHITECTURE.md"), false);
  assert.equal(isManualFilePath("README.md"), false);
  assert.equal(isManualFilePath("[generated]/SETUP_GUIDE.md"), false);
});
