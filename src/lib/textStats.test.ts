import { test } from "node:test";
import assert from "node:assert/strict";
import { textStats } from "@/lib/textStats";

test("counts words, characters, spaces and sentences", () => {
  const s = textStats("Hello brave new world. It works! Does it? Yes");
  assert.equal(s.words, 9);
  assert.equal(s.sentences, 4);
  assert.equal(s.spaces, 8);
  assert.equal(s.charactersNoSpaces, s.characters - s.spaces);
  assert.equal(s.longestWord, 5);
});

test("blocks are separated by newlines and counted as paragraphs", () => {
  const s = textStats("One line\n\nSecond line\nThird");
  assert.equal(s.paragraphs, 3);
  assert.equal(s.characters, "One lineSecond lineThird".length);
});

test("an empty note is all zeros and short notes read in one minute", () => {
  const empty = textStats("");
  assert.deepEqual([empty.words, empty.sentences, empty.readingMinutes, empty.longestWord], [0, 0, 0, 0]);
  assert.equal(textStats("just a few words").readingMinutes, 1);
});
