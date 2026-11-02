import { test } from "node:test";
import assert from "node:assert/strict";
import { findPicture, nameKey, type PeopleDirectory } from "@/types/people";

const directory: PeopleDirectory = {
  versions: { u1: 111, u2: 222 },
  idByName: { "dhruvil patel": "u1", "d patel": "u1" },
};

test("names match ignoring case and extra spaces", () => {
  assert.equal(nameKey("  Dhruvil   Patel "), "dhruvil patel");
});

test("a known id wins and returns that person's picture version", () => {
  assert.deepEqual(findPicture(directory, { userId: "u2", name: "Anyone" }), { id: "u2", version: 222 });
});

test("a name resolves through the directory, including linked owner names", () => {
  assert.deepEqual(findPicture(directory, { name: "DHRUVIL  patel" }), { id: "u1", version: 111 });
  assert.deepEqual(findPicture(directory, { name: "D Patel" }), { id: "u1", version: 111 });
});

test("people without a picture, and unknown names, get no version", () => {
  assert.deepEqual(findPicture(directory, { userId: "u3", name: "No Picture" }), { id: "u3", version: null });
  assert.deepEqual(findPicture(directory, { name: "Nobody Here" }), { id: null, version: null });
});
