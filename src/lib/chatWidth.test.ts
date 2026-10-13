import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_RIGHT_GAP,
  DEFAULT_CHAT_WIDTH,
  MIN_CHAT_WIDTH,
  chatWidthKey,
  clampChatWidth,
  maxChatWidth,
  parseStoredChatWidth,
  widthFromPointer,
} from "@/lib/chatWidth";

test("each person gets their own storage key", () => {
  assert.notEqual(chatWidthKey("a"), chatWidthKey("b"));
  assert.equal(chatWidthKey("u1"), "chatbot-width:u1");
});

test("clamp keeps the panel between the minimum and what the window allows", () => {
  assert.equal(clampChatWidth(100, 1400), MIN_CHAT_WIDTH);
  assert.equal(clampChatWidth(700, 1400), 700);
  assert.equal(clampChatWidth(5000, 1400), maxChatWidth(1400));
  assert.equal(clampChatWidth(Number.NaN, 1400), DEFAULT_CHAT_WIDTH);
});

test("on a small window the maximum leaves a strip of the page and never drops below the minimum", () => {
  assert.equal(maxChatWidth(1400), 1000);
  assert.equal(maxChatWidth(900), 780);
  assert.equal(maxChatWidth(300), MIN_CHAT_WIDTH);
});

test("parseStoredChatWidth accepts numbers, clamps them, and rejects junk", () => {
  assert.equal(parseStoredChatWidth("640", 1400), 640);
  assert.equal(parseStoredChatWidth("9999", 1000), maxChatWidth(1000));
  assert.equal(parseStoredChatWidth("abc", 1400), null);
  assert.equal(parseStoredChatWidth("", 1400), null);
  assert.equal(parseStoredChatWidth(null, 1400), null);
});

test("widthFromPointer puts the left edge under the pointer", () => {
  assert.equal(widthFromPointer(800, 1400), 1400 - CHAT_RIGHT_GAP - 800);
});
