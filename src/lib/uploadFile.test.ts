import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanFileName, displayTitle, fileExtension, formatFileSize, isInlineSafe } from "@/lib/uploadFile";

test("formats sizes for people", () => {
  assert.equal(formatFileSize(500), "500 B");
  assert.equal(formatFileSize(2048), "2 KB");
  assert.equal(formatFileSize(3 * 1024 * 1024), "3.0 MB");
});

test("extension is lower-cased and ignores dotfiles", () => {
  assert.equal(fileExtension("KT_01.PDF"), "pdf");
  assert.equal(fileExtension("archive.tar.gz"), "gz");
  assert.equal(fileExtension(".env"), "");
  assert.equal(fileExtension("README"), "");
});

test("only PDFs and common images may be shown inline", () => {
  assert.equal(isInlineSafe("application/pdf"), true);
  assert.equal(isInlineSafe("image/png"), true);
  assert.equal(isInlineSafe("text/html"), false);
  assert.equal(isInlineSafe("image/svg+xml"), false);
});

test("file names lose paths, quotes and control characters", () => {
  assert.equal(cleanFileName(String.raw`C:\Users\me\report.pdf`), "report.pdf");
  assert.equal(cleanFileName('a"b\nc.txt'), "abc.txt");
  assert.equal(cleanFileName("../../etc/passwd"), "passwd");
  assert.equal(cleanFileName("   "), "file");
});

test("display title drops a trailing extension that matches the file", () => {
  const file = { name: "KT_01.pdf" };
  assert.equal(displayTitle("KT 01 Hyperlink.pdf", file), "KT 01 Hyperlink");
  assert.equal(displayTitle("KT 01 Hyperlink", file), "KT 01 Hyperlink");
  assert.equal(displayTitle("Notes.pdf", null), "Notes.pdf");
});
